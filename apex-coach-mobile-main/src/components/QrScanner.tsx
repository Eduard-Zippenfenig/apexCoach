import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CameraOff } from "lucide-react";
import jsQR from "jsqr";

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned: (data?: string) => void;
}

export function QrScanner({ open, onClose, onScanned }: QrScannerProps) {
  const [status, setStatus] = useState<"scanning" | "found" | "syncing" | "done" | "error">("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const foundRef = useRef(false);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    foundRef.current = false;
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setStatus("scanning");
      setErrorMsg("");
      return;
    }

    foundRef.current = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanFrame();
      } catch {
        setStatus("error");
        setErrorMsg("Camera access denied. Please allow camera permission and try again.");
      }
    })();

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || foundRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) {
          foundRef.current = true;
          setStatus("found");
          stopCamera();
          setTimeout(() => {
            setStatus("syncing");
            setTimeout(() => {
              setStatus("done");
              setTimeout(() => onScanned(code.data), 800);
            }, 1500);
          }, 600);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col bg-black"
        >
          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-4">
            <h2 className="font-display text-lg font-bold text-white">Scan Tablet QR</h2>
            <button onClick={onClose} className="rounded-full bg-white/10 p-2 backdrop-blur-sm">
              <X size={20} className="text-white" />
            </button>
          </div>

          {/* Camera viewfinder */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {status !== "error" && (
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Dimming overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Scan frame */}
            <motion.div
              className="relative w-64 h-64 z-10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-primary rounded-br-lg" />

              {status === "scanning" && (
                <motion.div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_hsl(var(--primary))]"
                  initial={{ top: "10%" }}
                  animate={{ top: ["10%", "90%", "10%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CameraOff size={48} className="text-destructive" />
                </div>
              )}

              {(status === "found" || status === "syncing" || status === "done") && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="rounded-2xl bg-primary/20 border-2 border-primary p-6 backdrop-blur-sm">
                    <Zap size={48} className="text-primary" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Status text */}
          <div className="relative z-10 px-6 pb-16 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {status === "scanning" && (
                  <>
                    <p className="font-display text-base font-bold text-white">
                      Point camera at the tablet QR code
                    </p>
                    <p className="text-sm text-white/60 mt-1">
                      Find the QR code on the sync screen
                    </p>
                  </>
                )}
                {status === "error" && (
                  <p className="font-display text-base font-bold text-destructive">{errorMsg}</p>
                )}
                {status === "found" && (
                  <p className="font-display text-base font-bold text-primary">QR code detected!</p>
                )}
                {status === "syncing" && (
                  <>
                    <p className="font-display text-base font-bold text-white">Syncing session data…</p>
                    <div className="mt-3 mx-auto w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                      />
                    </div>
                    <p className="text-sm text-white/60 mt-2">Receiving telemetry, laps & analysis</p>
                  </>
                )}
                {status === "done" && (
                  <p className="font-display text-base font-bold text-primary">Session synced ✓</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
