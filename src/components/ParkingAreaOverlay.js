import React from 'react';

export default function ParkingAreaOverlay({ areaKey, area, onClick }) {
  const { overlay, color, name, totalSlots } = area;

  return (
    <button
      type="button"
      className="anu-area-overlay"
      style={{
        top: overlay.top,
        left: overlay.left,
        width: overlay.width,
        height: overlay.height,
        '--area-color': color,
      }}
      onClick={onClick}
      aria-label={`${name} — ${totalSlots} slots`}
    >
      <span className="anu-area-overlay__label">
        {name}
        <span className="anu-area-overlay__slots">{totalSlots} slots</span>
      </span>
    </button>
  );
}
