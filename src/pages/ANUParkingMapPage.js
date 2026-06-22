import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ANUParkingMap from '../components/ANUParkingMap';
import { LOT_NAME } from '../constants/alexandriaLot';
import { PARKGO_PENDING_SLOT_KEY } from '../constants/pendingSlot';
import './ANUParkingMapPage.css';

const ANUParkingMapPage = () => {
  const navigate = useNavigate();

  const handleSlotConfirm = useCallback(
    (area, slotNo) => {
      try {
        localStorage.setItem(PARKGO_PENDING_SLOT_KEY, slotNo);
      } catch { /* ignore */ }
      navigate('/login');
    },
    [navigate],
  );

  return (
    <div className="anu-page">
      <Navbar showAuthLinks />

      <main className="anu-page-main">
        <nav className="anu-page-breadcrumb" aria-label="Breadcrumb">
          <Link to="/book-parking" className="anu-page-back">
            ← Book parking
          </Link>
        </nav>

        <header className="anu-page-header">
          <h1 className="anu-page-title">{LOT_NAME}</h1>
          <p className="anu-page-subtitle">
            Tap a parking area on the map to view and reserve available slots.
          </p>
        </header>

        <ANUParkingMap onSlotConfirm={handleSlotConfirm} />
      </main>
    </div>
  );
};

export default ANUParkingMapPage;
