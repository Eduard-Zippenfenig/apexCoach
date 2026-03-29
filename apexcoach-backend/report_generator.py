"""
ApexCoach Backend — Natural Language Coaching Report Generator
Turns structured PostAnalysisResult into human-readable coaching text.
Uses rule-based templates (Option B).
"""
import os
import json
import logging
from typing import Dict, List
from dotenv import load_dotenv
from openai import OpenAI

from models import PostAnalysisResult, CornerAnalysis

logger = logging.getLogger(__name__)

# Load .env explicitly from the parent directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(dotenv_path=env_path)

client = None
try:
    if os.getenv("OPENAI_API_KEY"):
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
except Exception as e:
    logger.warning(f"Failed to initialize OpenAI client: {e}")

DRIVER_LEVELS = ["beginner", "intermediate", "advanced", "pro"]

# ─── Templates ────────────────────────────────────────────────

ISSUE_TEMPLATES = {
    # (issue, level) → template string
    ("early_braking", "beginner"): (
        "In {corner}, you're braking a bit too early. "
        "Try waiting until you see the brake marker before squeezing the pedal. "
        "This should give you more speed through the corner."
    ),
    ("early_braking", "intermediate"): (
        "{corner}: braking point is {brake_delta:.0f}m earlier than reference. "
        "Release threshold braking progressively into the apex to carry another "
        "{apex_delta:.0f} km/h through the mid-corner."
    ),
    ("early_braking", "advanced"): (
        "{corner}: you're over-slowing the entry by {brake_delta:.0f}m. "
        "Trail brake deeper to delay weight transfer, tighten the rotation, "
        "and pick up throttle at the apex earlier — the exit loss costs ~{time_loss:.2f}s."
    ),
    ("early_braking", "pro"): (
        "{corner}: brake ref is {brake_delta:.0f}m early. Trail deeper with progressive "
        "release to maximise rotation before apex. Throttle uptake is delayed — "
        "exit speed costs {time_loss:.2f}s to the next brake point."
    ),
    
    ("slow_apex", "beginner"): (
        "In {corner}, you're going a bit slow at the tightest part. "
        "Try to carry a little more speed — you have more grip than you think!"
    ),
    ("slow_apex", "intermediate"): (
        "{corner}: apex speed is {apex_delta:.0f} km/h below reference. "
        "Reduce initial braking and trail brake to maintain corner speed."
    ),
    ("slow_apex", "advanced"): (
        "{corner}: {apex_delta:.0f} km/h slow at apex. Reduce braking intensity "
        "and use trail braking to load the front axle, improving rotation and "
        "carrying speed. This costs ~{time_loss:.2f}s."
    ),
    ("slow_apex", "pro"): (
        "{corner}: apex Δ {apex_delta:.0f} km/h. Trail brake to rotate, "
        "maintain minimum speed at apex. Loss: {time_loss:.2f}s."
    ),
    
    ("late_throttle", "beginner"): (
        "In {corner}, you could get on the gas a little sooner as you leave the corner. "
        "Once you feel the car straighten, start gently pressing the throttle."
    ),
    ("late_throttle", "intermediate"): (
        "{corner}: throttle application is {throttle_delta:.0f}m later than reference. "
        "Begin feeding in throttle as soon as you unwind the steering."
    ),
    ("late_throttle", "advanced"): (
        "{corner}: throttle pickup {throttle_delta:.0f}m late, costing {exit_delta:.0f} km/h "
        "exit speed. Begin throttle application at the apex and progressively increase "
        "as you unwind steering. Loss: ~{time_loss:.2f}s."
    ),
    ("late_throttle", "pro"): (
        "{corner}: throttle {throttle_delta:.0f}m delayed. Exit speed Δ {exit_delta:.0f} km/h. "
        "Overlap brake-throttle at apex for rotation, immediate full throttle on unwind. "
        "Cost: {time_loss:.2f}s."
    ),
    
    ("line", "beginner"): (
        "In {corner}, your car is a bit far from the ideal line. "
        "Try to aim closer to the inside of the corner at the tightest point."
    ),
    ("line", "intermediate"): (
        "{corner}: average line deviation is {line_dev:.1f}m from reference. "
        "Focus on hitting the apex clipping point and using all the track on exit."
    ),
    ("line", "advanced"): (
        "{corner}: line deviation avg {line_dev:.1f}m (max {max_line_dev:.1f}m). "
        "Optimise turn-in point and apex for a later, tighter apex allowing "
        "earlier full throttle. Loss: ~{time_loss:.2f}s."
    ),
    ("line", "pro"): (
        "{corner}: line Δ avg {line_dev:.1f}m, max {max_line_dev:.1f}m. "
        "Adjust turn-in for late apex geometry. Cost: {time_loss:.2f}s."
    ),
    
    ("good", "beginner"): "Great job in {corner}! You're doing really well here.",
    ("good", "intermediate"): "{corner}: solid execution — within reference margins.",
    ("good", "advanced"): "{corner}: clean sector, matching reference pace.",
    ("good", "pro"): "{corner}: on pace.",
}

EXEC_SUMMARY_TEMPLATES = {
    "beginner": (
        "Great effort, {name}! Your lap time of {user_time:.1f}s is {gap:.1f}s "
        "behind the reference ({ref_time:.1f}s). There are some easy wins that "
        "can help you close that gap — let's go through them!"
    ),
    "intermediate": (
        "{name}, your {user_time:.1f}s lap is {gap:.1f}s off the reference "
        "pace of {ref_time:.1f}s. The biggest gains are in braking zones and "
        "corner exits. Here's a corner-by-corner breakdown."
    ),
    "advanced": (
        "{name}: {user_time:.1f}s vs {ref_time:.1f}s reference ({gap:+.1f}s). "
        "Primary deficit in {weakest}. Consistency score: {consistency:.0f}/100. "
        "Key areas: braking ({brake_score}/100), throttle ({throttle_score}/100), "
        "line ({line_score}/100)."
    ),
    "pro": (
        "{gap:+.1f}s gap. Weakest: {weakest}. Scores: B{brake_score} T{throttle_score} "
        "L{line_score} S{smooth_score}. Focus on {focus}."
    ),
}


def generate_coaching_report(
    analysis: PostAnalysisResult,
    driver_level: str = "intermediate",
    driver_name: str = "Driver",
) -> Dict:
    """Generate structured coaching report from analysis data."""
    if client is None or not os.getenv("OPENAI_API_KEY"):
        logger.warning("No OpenAI client or API key, falling back to rule-based generation")
        return generate_coaching_report_fallback(analysis, driver_level, driver_name)

    try:
        system_prompt = f"""
You are an elite track driving coach and motorsport performance analyst.

You are analyzing telemetry and structured lap-comparison data for a driver named '{driver_name}' with skill level '{driver_level}'.
Your job is to produce a highly detailed, individualized, practical post-session coaching report.

Your report must feel like a premium driver debrief from a real expert coach reviewing the lap carefully.

PRIMARY OBJECTIVE
Use all provided information to identify the driver's highest-impact improvement opportunities.
Do not just describe what happened in each corner. Interpret the deeper driving patterns across the lap.

You must:
- identify the biggest time losses
- explain the likely technical cause of each issue
- explain the effect on car balance, grip, rotation, apex speed, and exit speed where relevant
- connect repeated corner issues into broader driver habits
- prioritize the most important changes first
- tailor the coaching to the driver's skill level
- write clearly enough for a non-professional driver to understand
- be detailed, practical, and highly actionable

PRIORITIZATION ORDER
Prioritize feedback in this order:
1. Safety-critical or stability-related issues
2. Repeated technique errors across multiple corners
3. Large time-loss opportunities
4. Consistency and confidence issues
5. Fine pace optimization

COACHING QUALITY RULES
For every major recommendation:
- explain what the driver is doing now
- explain why it is costing time or reducing consistency
- explain what the driver should do differently
- explain what they should feel when doing it correctly
- explain a common mistake to avoid
- connect the advice directly to the provided telemetry/analysis data

Do not be generic.
Do not give shallow one-line tips.
Do not use Formula 1 engineer jargon unless necessary.
Do not invent data that was not provided.
Do not mention every corner equally if some matter much more than others.
Group repeated issues into meaningful driving themes.

OUTPUT FORMAT
Return valid JSON only, matching exactly this schema:

{{
  "executive_summary": "A detailed overall summary of the lap, biggest issues, and biggest opportunities.",
  "driver_profile_interpretation": {{
    "main_strengths": ["..."],
    "main_weaknesses": ["..."],
    "priority_focus": ["..."],
    "driving_style_observations": ["..."]
  }},
  "biggest_time_opportunities": [
    {{
      "theme": "Short theme name",
      "corners_affected": ["Corner 1", "Corner 2"],
      "estimated_total_gain_s": 0.0,
      "why_it_matters": "Detailed explanation"
    }}
  ],
  "corner_reports": [
    {{
      "corner": "Corner name",
      "priority": 1,
      "headline": "Short issue headline",
      "detail": "Detailed explanation of what is happening, why it matters, and why time is being lost.",
      "root_cause": "Likely underlying driver habit or technical cause.",
      "instruction": "Specific next-lap instruction.",
      "what_to_feel": "What the driver should notice when applying the fix correctly.",
      "common_mistake_to_avoid": "A likely mistake or misunderstanding to avoid.",
      "time_gain": "~0.00s"
    }}
  ],
  "next_session_focus": [
    {{
      "title": "Short focus item",
      "why": "Why this should be prioritized next session",
      "drill": "A simple practice focus or drill the driver can use next session"
    }}
  ],
  "scores": {{
    "braking": 0,
    "line": 0,
    "throttle": 0,
    "smoothness": 0
  }}
}}
"""

        corners_data = []
        issue_counts = {}
        for c in analysis.corners:
            issue_counts[c.primary_issue] = issue_counts.get(c.primary_issue, 0) + 1
            corners_data.append({
                "corner_name": c.corner_name,
                "primary_issue": c.primary_issue,
                "estimated_time_loss_s": c.estimated_time_loss_s,
                "brake_point_delta_m": c.brake_point_delta_m,
                "throttle_delay_delta_m": c.throttle_delay_delta_m,
                "apex_speed_delta_kph": c.apex_speed_delta_kph,
                "exit_speed_delta_kph": c.exit_speed_delta_kph,
                "avg_line_deviation_m": c.avg_line_deviation_m,
                "coaching_priority": c.coaching_priority
            })

        user_prompt = f"""
Driver name: {driver_name}
Driver level: {driver_level}

Lap comparison:
- User lap time: {analysis.lap_time_user_s}s
- Reference lap time: {analysis.lap_time_ref_s}s
- Total gap: {analysis.total_time_gap_s}s
- Weakest section: {analysis.weakest_section}
- Strongest section: {analysis.strongest_section}
- Consistency score: {analysis.consistency_score}
- Overall scores: {json.dumps(analysis.overall_scores)}

Top improvements:
{json.dumps(analysis.top_3_improvements, indent=2)}

Issue frequency across corners:
{json.dumps(issue_counts, indent=2)}

Corner-by-corner analysis:
{json.dumps(corners_data, indent=2)}

Please identify:
1. the biggest repeated driving patterns,
2. the highest-value time-gain opportunities,
3. the most important next-session coaching priorities,
4. detailed corner-specific coaching where justified.

Return only valid JSON.
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3
        )

        content = response.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        logger.error(f"OpenAI generation failed: {e}")
        return generate_coaching_report_fallback(analysis, driver_level, driver_name)

def generate_coaching_report_fallback(
    analysis: PostAnalysisResult,
    driver_level: str = "intermediate",
    driver_name: str = "Driver",
) -> Dict:
    """Fallback: Generate structured coaching report from analysis data."""
    if driver_level not in DRIVER_LEVELS:
        driver_level = "intermediate"
    
    scores = analysis.overall_scores
    
    # Executive summary
    exec_template = EXEC_SUMMARY_TEMPLATES.get(driver_level, EXEC_SUMMARY_TEMPLATES["intermediate"])
    focus_area = analysis.top_3_improvements[0]["issue"] if analysis.top_3_improvements else "consistency"
    
    try:
        executive_summary = exec_template.format(
            name=driver_name,
            user_time=analysis.lap_time_user_s,
            ref_time=analysis.lap_time_ref_s,
            gap=analysis.total_time_gap_s,
            weakest=analysis.weakest_section,
            consistency=analysis.consistency_score,
            brake_score=scores.get("braking", 0),
            throttle_score=scores.get("throttle", 0),
            line_score=scores.get("line", 0),
            smooth_score=scores.get("smoothness", 0),
            focus=focus_area,
        )
    except (KeyError, IndexError):
        executive_summary = (
            f"{driver_name}: lap time {analysis.lap_time_user_s:.1f}s, "
            f"gap to reference {analysis.total_time_gap_s:+.1f}s."
        )
    
    # Biggest win
    biggest_win = ""
    if analysis.top_3_improvements:
        top = analysis.top_3_improvements[0]
        biggest_win = (
            f"Your biggest time gain (~{top['gain_s']:.2f}s) is in {top['corner']}: "
            f"{top['suggestion']}"
        )
    
    # Best section
    best_section = f"Your strongest section is {analysis.strongest_section} — keep it up!"
    
    # Corner reports
    corner_reports = []
    for corner in analysis.corners:
        report = _generate_corner_report(corner, driver_level)
        corner_reports.append(report)
    
    # Sort by coaching priority
    corner_reports.sort(key=lambda r: r.get("priority", 99))
    
    # Next session focus
    focus_items = []
    for imp in analysis.top_3_improvements:
        focus_items.append(imp["suggestion"])
    while len(focus_items) < 3:
        focus_items.append("Maintain consistency.")
    
    return {
        "executive_summary": executive_summary,
        "biggest_win": biggest_win,
        "best_section": best_section,
        "corner_reports": corner_reports,
        "next_session_focus": focus_items[:3],
        "scores": scores,
    }


def _generate_corner_report(corner: CornerAnalysis, level: str) -> Dict:
    """Generate a single corner report dict."""
    issue = corner.primary_issue
    
    # Get template
    template_key = (issue, level)
    template = ISSUE_TEMPLATES.get(template_key)
    
    if template is None:
        # Fallback to intermediate
        template = ISSUE_TEMPLATES.get((issue, "intermediate"), "{corner}: analysis complete.")
    
    # Format template
    try:
        detail = template.format(
            corner=corner.corner_name,
            brake_delta=abs(corner.brake_point_delta_m),
            apex_delta=abs(corner.apex_speed_delta_kph),
            exit_delta=abs(corner.exit_speed_delta_kph),
            throttle_delta=abs(corner.throttle_delay_delta_m),
            time_loss=corner.estimated_time_loss_s,
            line_dev=corner.avg_line_deviation_m,
            max_line_dev=corner.max_line_deviation_m,
        )
    except (KeyError, IndexError, ValueError):
        detail = f"{corner.corner_name}: time loss ~{corner.estimated_time_loss_s:.2f}s."
    
    # Headline
    headlines = {
        "early_braking": f"Braking too early — {abs(corner.brake_point_delta_m):.0f}m to gain",
        "slow_apex": f"Apex speed too low — {abs(corner.apex_speed_delta_kph):.0f} km/h gap",
        "late_throttle": f"Late throttle application — {abs(corner.throttle_delay_delta_m):.0f}m delayed",
        "line": f"Racing line deviation — {corner.avg_line_deviation_m:.1f}m off",
        "good": "Good execution",
    }
    headline = headlines.get(issue, "Analysis complete")
    
    # Instruction
    instructions = {
        "early_braking": f"Next lap: brake {abs(corner.brake_point_delta_m):.0f}m later and trail brake to the apex.",
        "slow_apex": f"Next lap: carry {abs(corner.apex_speed_delta_kph):.0f} km/h more mid-corner.",
        "late_throttle": f"Next lap: begin throttle as soon as you start unwinding the wheel.",
        "line": f"Next lap: aim for a tighter apex and use more track on exit.",
        "good": "Keep doing what you're doing here.",
    }
    instruction = instructions.get(issue, "Maintain current approach.")
    
    return {
        "corner": corner.corner_name,
        "priority": corner.coaching_priority,
        "headline": headline,
        "detail": detail,
        "instruction": instruction,
        "time_gain": f"~{corner.estimated_time_loss_s:.2f}s",
    }
