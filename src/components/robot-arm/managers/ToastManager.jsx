import React from 'react';

export function ToastManager({ limitToast, demoToast, children }) {
  return (
    <>
      {limitToast.visible && (
        <div key={limitToast.seq} className="armLimitToast" role="status" aria-live="polite">
          {limitToast.message}
        </div>
      )}
      {demoToast.visible && (
        <div
          key={demoToast.seq}
          className={`armDemoToast ${demoToast.tone}`}
          role="status"
          aria-live="polite"
        >
          <div className="armDemoToastTitle">{demoToast.title}</div>
          {demoToast.detail && <div className="armDemoToastDetail">{demoToast.detail}</div>}
        </div>
      )}
      {children}
    </>
  );
}
