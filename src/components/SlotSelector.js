import React from 'react';

export default function SlotSelector({ slots, selectedSlot, onSlotSelect }) {
  return (
    <div className="anu-slots-wrap">
      <div className="anu-slots-stats">
        <span className="anu-slots-stat anu-slots-stat--available">
          <strong>{slots.length}</strong> total slots
        </span>
        {selectedSlot && (
          <span className="anu-slots-stat anu-slots-stat--selected-info">
            Selected: <strong>{selectedSlot}</strong>
          </span>
        )}
      </div>

      <div className="anu-slots-legend">
        <span className="anu-slots-legend-item">
          <span className="anu-slots-swatch anu-slots-swatch--available" /> Available
        </span>
        <span className="anu-slots-legend-item">
          <span className="anu-slots-swatch anu-slots-swatch--selected" /> Selected
        </span>
      </div>

      <div className="anu-slots-grid">
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot.slot_no;
          return (
            <button
              key={slot.slot_no}
              type="button"
              className={`anu-slot anu-slot--available ${isSelected ? 'anu-slot--selected' : ''}`}
              onClick={() => onSlotSelect(slot.slot_no)}
              aria-pressed={isSelected}
              aria-label={`Slot ${slot.slot_no}${isSelected ? ', selected' : ''}`}
            >
              {slot.slot_no}
            </button>
          );
        })}
      </div>
    </div>
  );
}
