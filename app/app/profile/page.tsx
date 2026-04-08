"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import ClaudiaCharacter from "@/components/ClaudiaCharacter";
import { useSessionToken } from "@/hooks/useSessionToken";

const PRESET_AVATARS = [
  { id: "default", label: "Default", mood: "idle" as const },
  { id: "thinking", label: "Thinking", mood: "thinking" as const },
  { id: "excited", label: "Excited", mood: "excited" as const },
  { id: "skeptical", label: "Skeptical", mood: "skeptical" as const },
  { id: "talking", label: "Talking", mood: "talking" as const },
];

export default function ProfilePage() {
  const { sessionToken } = useSessionToken();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("default");

  useEffect(() => {
    if (!sessionToken) return;
    fetch("/api/profile", { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then((r) => r.json())
      .then((data: any) => {
        setProfile(data);
        setDisplayName(data.displayName || "");
        setTagline(data.tagline || "");
        setXHandle(data.xHandle || "");
        setSelectedAvatar(data.avatarPreset || "default");
      })
      .catch(() => {});
  }, [sessionToken]);

  const handleSave = async () => {
    if (!sessionToken) return;
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, tagline, xHandle, avatarPreset: selectedAvatar }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <TokenGate featureName="Profile">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-white font-heading text-2xl mb-2">Your Profile</h1>
          <p className="text-zinc-500 text-sm mb-8">visible on the leaderboard</p>

          {/* Avatar selector */}
          <div className="bg-surface rounded-2xl p-6 border border-white/5 mb-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-4">Choose Avatar</p>
            <div className="grid grid-cols-5 gap-3">
              {PRESET_AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    selectedAvatar === avatar.id
                      ? "border-accent bg-accent/10"
                      : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <ClaudiaCharacter imageSrc="/avatar.png" mood={avatar.mood} size="tiny" />
                  <span className="text-xs text-zinc-400">{avatar.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="bg-surface rounded-2xl p-6 border border-white/5 mb-4 space-y-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Profile Info</p>

            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Display Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                placeholder="CryptoNate"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-accent/30"
              />
              <p className="text-zinc-700 text-xs mt-1">{displayName.length}/32</p>
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Tagline</label>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={80}
                placeholder="Base degen. ngmi if wrong."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-accent/30"
              />
              <p className="text-zinc-700 text-xs mt-1">{tagline.length}/80</p>
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">X / Twitter</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                <input
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value.replace("@", ""))}
                  maxLength={32}
                  placeholder="0xCryptoNate"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-accent/30"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          {profile?.stats && (
            <div className="bg-surface rounded-2xl p-6 border border-white/5 mb-6">
              <p className="text-zinc-400 text-xs uppercase tracking-wider mb-4">Your Stats</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-white font-heading text-xl">{profile.stats.totalCreditsSpent || 0}</p>
                  <p className="text-zinc-500 text-xs">credits spent</p>
                </div>
                <div>
                  <p className="text-white font-heading text-xl">{profile.stats.totalActiveDays || 0}</p>
                  <p className="text-zinc-500 text-xs">active days</p>
                </div>
                <div>
                  <p className="text-white font-heading text-xl">
                    {profile.stats.memberSince ? new Date(profile.stats.memberSince).toLocaleDateString() : "—"}
                  </p>
                  <p className="text-zinc-500 text-xs">member since</p>
                </div>
              </div>
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-accent hover:bg-[#27c00e] disabled:opacity-50 text-white font-heading font-bold py-4 rounded-2xl transition-all"
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
          </button>
        </div>
      </TokenGate>
    </DashboardLayout>
  );
}
