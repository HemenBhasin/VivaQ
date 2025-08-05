import React from 'react';
import LightRays from './LightRays';

const AdminLayout = ({ children }) => {
  return (
    <div className="relative min-h-screen">
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
        <LightRays
          raysOrigin="top-center"
          raysColor="#00ffff"
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0.1}
          distortion={0.05}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;
