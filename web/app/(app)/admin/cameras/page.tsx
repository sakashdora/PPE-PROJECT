"use client";

import React, { useState } from "react";
import { CameraStream } from "@/lib/types";
import {
  Video,
  Plus,
  CheckCircle,
  Settings,
} from "lucide-react";

const INITIAL_CAMERAS: CameraStream[] = [
  {
    id: "cam-01",
    name: "Camera 01 (Main Loading)",
    sector: "Sector 1",
    location: "Loading Bay & Logistics",
    sourceType: "file",
    sourceUrl: "videos/loading_bay.mp4",
    status: "online",
    fps: 14.8,
    latencyMs: 32,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
  {
    id: "cam-02",
    name: "Camera 02 (Chemical Storage)",
    sector: "Sector 2",
    location: "Chemical Storage & Flammables",
    sourceType: "file",
    sourceUrl: "videos/chemical_storage.mp4",
    status: "online",
    fps: 15.1,
    latencyMs: 29,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
  {
    id: "cam-03",
    name: "Camera 03 (Assembly)",
    sector: "Sector 3",
    location: "Precision Assembly Line",
    sourceType: "file",
    sourceUrl: "videos/assembly.mp4",
    status: "online",
    fps: 14.6,
    latencyMs: 35,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
  {
    id: "cam-04",
    name: "Camera 04 (Furnace)",
    sector: "Sector 4",
    location: "High-Heat Furnace Hall",
    sourceType: "file",
    sourceUrl: "videos/furnace.mp4",
    status: "online",
    fps: 15.0,
    latencyMs: 31,
    lastSeen: "2026-09-19T22:50:00.000Z",
    resolution: "1920x1080",
    activeAlertCount: 0,
    hasCritical: false,
  },
];

export default function CamerasAdminPage() {
  const [cameras, setCameras] = useState<CameraStream[]>(INITIAL_CAMERAS);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSector, setNewSector] = useState("Sector 1");
  const [newUrl, setNewUrl] = useState("rtsp://admin:pass@192.168.1.120:554/live");

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCam: CameraStream = {
      id: `cam-0${cameras.length + 1}`,
      name: newName,
      sector: newSector,
      location: `${newSector} Zone`,
      sourceType: newUrl.startsWith("rtsp") ? "rtsp" : "file",
      sourceUrl: newUrl,
      status: "online",
      fps: 15.0,
      latencyMs: 34,
      lastSeen: new Date().toISOString(),
      resolution: "1920x1080",
      activeAlertCount: 0,
      hasCritical: false,
    };

    setCameras([...cameras, newCam]);
    setNewName("");
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2.5 font-display">
            <Video className="w-6 h-6 text-copper" />
            <span>Camera Stream Management (Admin)</span>
          </h1>
          <p className="text-xs text-text-secondary font-mono mt-0.5">
            Ingest real-time RTSP hardware feeds or benchmark demo surveillance clips
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-copper hover:bg-copper-hover text-base rounded-sm text-xs font-mono font-bold flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Camera</span>
        </button>
      </div>

      {/* Camera Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cameras.map((cam) => (
          <div
            key={cam.id}
            className="p-4 bg-surface border border-border rounded-sm space-y-3 font-mono text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-none bg-jade animate-pulse" />
                <span className="font-bold text-text-primary text-sm font-display">{cam.name}</span>
              </div>
              <span className="text-3xs px-2 py-0.5 rounded-sm bg-base text-text-secondary border border-border">
                {cam.id.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-2xs text-text-secondary bg-base p-2.5 rounded-sm border border-border">
              <div>
                <span className="text-text-secondary">ASSIGNED SECTOR:</span>
                <div className="font-bold text-text-primary mt-0.5">{cam.sector}</div>
              </div>
              <div>
                <span className="text-text-secondary">SOURCE TYPE:</span>
                <div className="font-bold text-copper mt-0.5">{cam.sourceType.toUpperCase()}</div>
              </div>
              <div>
                <span className="text-text-secondary">MEASURED FPS:</span>
                <div className="font-bold text-jade mt-0.5">{cam.fps.toFixed(1)} FPS</div>
              </div>
              <div>
                <span className="text-text-secondary">EDGE LATENCY:</span>
                <div className="font-bold text-text-primary mt-0.5">{cam.latencyMs} ms</div>
              </div>
            </div>

            <div className="text-2xs text-text-secondary truncate">
              <span className="text-text-secondary">URI: </span>
              <span className="text-text-primary">{cam.sourceUrl}</span>
            </div>

            <div className="pt-2 border-t border-border flex justify-between items-center text-2xs">
              <span className="text-jade flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Auto-Reconnect Armed
              </span>
              <span className="px-2.5 py-1 bg-elevated text-text-secondary rounded-sm flex items-center gap-1 border border-border">
                <Settings className="w-3 h-3 text-copper" /> Active ONNX Channel
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Camera Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-elevated border border-border rounded-sm p-6 w-full max-w-md font-mono">
            <h3 className="text-base font-bold font-display text-text-primary mb-4">Add Camera Feed</h3>
            <form onSubmit={handleAddCamera} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Camera Label:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Overhead Loading Gate 3"
                  className="w-full px-3 py-2 bg-base border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Sector:</label>
                <select
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                >
                  <option value="Sector 1">Sector 1: Loading Bay</option>
                  <option value="Sector 2">Sector 2: Chemical Storage</option>
                  <option value="Sector 3">Sector 3: Assembly Line</option>
                  <option value="Sector 4">Sector 4: Furnace Hall</option>
                </select>
              </div>

              <div>
                <label className="block text-text-secondary mb-1">RTSP Stream URL or Video File Path:</label>
                <input
                  type="text"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-sm text-text-primary focus:outline-none focus:border-copper"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-copper hover:bg-copper-hover text-base font-bold rounded-sm"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
