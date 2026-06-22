import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./AuthPages.css";
import { PARKGO_PENDING_SLOT_KEY } from "../constants/pendingSlot";
import { createReservation } from "../api/bookingApi";

import { PARKGO_PAYMENT_SUCCESS_TOAST_KEY } from "../constants/paymentToast";

const STORAGE_KEY = "parkgo_pay_pending";

/** Decode Paymob transaction redirect query params into a readable line */
function paymobFailureHint(params) {
  const txn = params.get("txn_response_code");
  const dataMsg = params.get("data.message");
  const topMsg = params.get("message") || "";
  const acq = params.get("acq_response_code") || "";
  const parts = [txn || "", dataMsg || topMsg || "", acq && acq !== "00" ? `acq=${acq}` : ""].filter(Boolean);
  const s = parts.join(" — ").trim();
  return s || null;
}

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Finalizing your booking…");
  /** pending: working; success: payment + booking saved; failed: show error/retry */
  const [completed, setCompleted] = useState("pending");
  const [canRetry, setCanRetry] = useState(false);
  const ran = useRef(false);
  const successNavTimer = useRef(null);

  const navigateToDashboardWithSuccessToast = () => {
    try {
      sessionStorage.setItem(PARKGO_PAYMENT_SUCCESS_TOAST_KEY, "1");
    } catch {
      /* ignore */
    }
    navigate("/user", { replace: true });
  };

  useEffect(() => {
    return () => {
      if (successNavTimer.current != null) {
        clearTimeout(successNavTimer.current);
        successNavTimer.current = null;
      }
    };
  }, []);

  const finalize = async () => {
    setCompleted("pending");
    setCanRetry(false);
    setMsg("Finalizing your booking…");
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setCompleted("failed");
      setMsg("No pending payment session. Start again from the dashboard.");
      setCanRetry(false);
      return;
    }
    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      setCompleted("failed");
      setMsg("Invalid payment session.");
      setCanRetry(false);
      return;
    }

    try {
      const result = await createReservation({
        userId: pending.userId,
        startTime: pending.startTime,
        endTime: pending.endTime,
        totalAmount: pending.totalAmount,
        paymentMethod: "card",
        slotNo: undefined,
      });
      sessionStorage.removeItem(STORAGE_KEY);
      try {
        localStorage.removeItem(PARKGO_PENDING_SLOT_KEY);
      } catch {
        /* ignore */
      }

      if (!result.ok) {
        setCompleted("failed");
        setMsg(result.error || "Could not create reservation after payment.");
        setCanRetry(true);
        return;
      }
      setCompleted("success");
      setMsg("Payment completed successfully. Your reservation is confirmed.");
      successNavTimer.current = window.setTimeout(() => {
        successNavTimer.current = null;
        navigateToDashboardWithSuccessToast();
      }, 2500);
    } catch (e) {
      setCompleted("failed");
      setMsg(e.message || "Cannot reach server");
      setCanRetry(true);
    }
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const successRaw = params.get("success");
    const failed =
      successRaw === "false" ||
      successRaw === "False" ||
      params.get("error_occured") === "true" ||
      params.get("error_occured") === "True";
    if (failed) {
      setCompleted("failed");
      const hint = paymobFailureHint(params);
      setMsg(
        hint
          ? `Payment did not complete. ${hint}`
          : "Payment failed or was cancelled."
      );
      setCanRetry(true);
      return;
    }
    finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-page-wrap">
      <Navbar />
      <div className="auth-container">
        <div className="auth-card">
          <h2>Payment status</h2>
          {completed === "success" ? (
            <div className="success-message" role="status">
              <strong>{msg}</strong>
              <p className="auth-subtitle" style={{ marginTop: 12, marginBottom: 0 }}>
                Taking you to your dashboard in a moment…
              </p>
            </div>
          ) : (
            <p className="auth-subtitle">{msg}</p>
          )}
          {canRetry && completed !== "success" && (
            <button type="button" className="auth-button" onClick={() => navigate("/user")}>
              Try again
            </button>
          )}
          {completed === "success" && (
            <button
              type="button"
              className="auth-button mt-2"
              onClick={() => {
                if (successNavTimer.current != null) {
                  clearTimeout(successNavTimer.current);
                  successNavTimer.current = null;
                }
                navigateToDashboardWithSuccessToast();
              }}
            >
              Go to dashboard now
            </button>
          )}
          {completed !== "success" && (
            <button
              type="button"
              className="btn btn-secondary mt-3 w-100"
              onClick={() => navigate("/user")}
              disabled={completed === "pending"}
            >
              Back to dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
