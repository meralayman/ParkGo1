import React, { useState, useMemo, useCallback } from 'react';
import SlotSelector from './SlotSelector';
import './ANUParkingMap.css';

const MAP_IMAGE = `${process.env.PUBLIC_URL || ''}/anu-parking-map.jpg`;

const PARKING_AREAS = {
  A: {
    name: 'Parking Area A',
    totalSlots: 90,
    color: '#22c55e',
    zoom: { scale: 2, originX: 73, originY: 49 },
  },
  B: {
    name: 'Parking Area B',
    totalSlots: 45,
    color: '#f59e0b',
    zoom: { scale: 2.2, originX: 25, originY: 41 },
  },
  C: {
    name: 'Parking Area C',
    totalSlots: 28,
    color: '#ef4444',
    zoom: { scale: 3, originX: 20, originY: 10 },
  },
  D: {
    name: 'Parking Area D',
    totalSlots: 16,
    color: '#3b82f6',
    zoom: { scale: 2.8, originX: 28, originY: 74 },
  },
};

function generateSlots(areaKey, total) {
  const slots = [];
  for (let i = 1; i <= total; i++) {
    slots.push({ slot_no: `${areaKey}${i}`, state: 0 });
  }
  return slots;
}

export default function ANUParkingMap({ onSlotConfirm }) {
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const areaSlots = useMemo(() => {
    if (!selectedArea) return [];
    return generateSlots(selectedArea, PARKING_AREAS[selectedArea].totalSlots);
  }, [selectedArea]);

  const handleAreaClick = useCallback((key) => {
    setSelectedSlot(null);
    setSelectedArea(key);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedArea(null);
    setSelectedSlot(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedArea && selectedSlot && onSlotConfirm) {
      onSlotConfirm(selectedArea, selectedSlot);
    }
  }, [selectedArea, selectedSlot, onSlotConfirm]);

  const area = selectedArea ? PARKING_AREAS[selectedArea] : null;

  return (
    <div className="anu-map-root">
      {!selectedArea && (
        <div className="anu-map-viewport">
          <img
            src={MAP_IMAGE}
            alt="Alexandria National University Parking Map"
            className="anu-map-image"
            draggable={false}
          />
        </div>
      )}

      {!selectedArea && (
        <div className="anu-area-cards">
          {Object.entries(PARKING_AREAS).map(([key, a]) => (
            <button
              key={key}
              type="button"
              className="anu-area-card"
              style={{ '--card-accent': a.color }}
              onClick={() => handleAreaClick(key)}
            >
              <span className="anu-area-card__badge" style={{ background: a.color }}>
                {key}
              </span>
              <div className="anu-area-card__info">
                <span className="anu-area-card__name">{a.name}</span>
                <span className="anu-area-card__slots">{a.totalSlots} slots</span>
              </div>
              <svg className="anu-area-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {selectedArea && (
        <div className="anu-detail-panel">
          <div className="anu-detail-header">
            <button type="button" className="anu-back-btn" onClick={handleBack}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Full Map
            </button>

            <div className="anu-detail-title-row">
              <span className="anu-area-badge" style={{ background: area.color }}>
                {selectedArea}
              </span>
              <div>
                <h2 className="anu-detail-title">{area.name}</h2>
                <p className="anu-detail-subtitle">{area.totalSlots} total slots</p>
              </div>
            </div>
          </div>

          <SlotSelector
            slots={areaSlots}
            selectedSlot={selectedSlot}
            onSlotSelect={setSelectedSlot}
          />

          {selectedSlot && (
            <div className="anu-confirm-bar">
              <p className="anu-confirm-msg">
                Slot <strong>{selectedSlot}</strong> in <strong>{area.name}</strong> selected.
              </p>
              <button type="button" className="anu-confirm-btn" onClick={handleConfirm}>
                Confirm Reservation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
