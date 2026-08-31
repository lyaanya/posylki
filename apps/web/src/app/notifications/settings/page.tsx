"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import {
  fetchNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications";

type Group = "messages" | "listings" | "service";
type Channel = "push" | "email" | "telegram";

const GROUPS: { key: Group; label: string }[] = [
  { key: "messages", label: dictionary.notifications.groupMessages },
  { key: "listings", label: dictionary.notifications.groupListings },
  { key: "service", label: dictionary.notifications.groupService },
];

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "push", label: dictionary.notifications.channelPush },
  { key: "email", label: dictionary.notifications.channelEmail },
  { key: "telegram", label: dictionary.notifications.channelTelegram },
];

function fieldName(group: Group, channel: Channel): keyof NotificationSettings {
  return `${group}${channel[0]!.toUpperCase()}${channel.slice(1)}` as keyof NotificationSettings;
}

/** ТЗ E14 пп.14.7-14.9 — переключатели по группам и каналам; группы "сделки" здесь нет — её нельзя отключить. */
export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetchNotificationSettings()
      .then(setSettings)
      .catch(() => null);
  }, []);

  async function handleToggle(group: Group, channel: Channel) {
    if (!settings) return;
    const field = fieldName(group, channel);
    const next = { [field]: !settings[field] };
    setSettings({ ...settings, ...next });
    const updated = await updateNotificationSettings(next).catch(() => null);
    if (updated) {
      setSettings(updated);
      setSavedAt(Date.now());
    }
  }

  return (
    <div className="py-6">
      <Link href="/notifications" className="text-sm text-muted-foreground hover:text-foreground">
        {dictionary.notifications.settingsBackCta}
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">
        {dictionary.notifications.settingsTitle}
      </h1>

      {settings === null ? (
        <p className="mt-5 text-sm text-muted-foreground">{dictionary.notifications.loading}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group.key} className="rounded-md border border-border bg-card p-4 shadow-sm">
              <p className="font-heading text-sm font-bold text-card-foreground">{group.label}</p>
              <div className="mt-3 flex gap-4">
                {CHANNELS.map((channel) => {
                  const field = fieldName(group.key, channel.key);
                  return (
                    <label key={channel.key} className="flex items-center gap-1.5 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={settings[field]}
                        onChange={() => handleToggle(group.key, channel.key)}
                        className="size-4 accent-action"
                      />
                      {channel.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="font-heading text-sm font-bold text-muted-foreground">
              {dictionary.notifications.groupDealsTitle}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{dictionary.notifications.groupDealsNote}</p>
          </div>

          {savedAt ? <p className="text-xs text-muted-foreground">{dictionary.notifications.saved}</p> : null}
        </div>
      )}
    </div>
  );
}
