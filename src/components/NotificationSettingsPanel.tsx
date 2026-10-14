import { useState } from 'react';
import { Volume2, VolumeX, Bell, X, Play } from 'lucide-react';
import {
  type NotificationSettings,
  type SoundType,
  soundLabels,
  soundOptions,
  playNotificationSound,
} from '@/lib/notificationSound';

interface NotificationSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}

export function NotificationSettingsPanel({ open, onClose, settings, onChange }: NotificationSettingsPanelProps) {
  if (!open) return null;

  function update(partial: Partial<NotificationSettings>) {
    onChange({ ...settings, ...partial });
  }

  function preview() {
    playNotificationSound({ ...settings, enabled: true });
  }

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white animate-slide-in-right flex flex-col shadow-xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-ink-100">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-brand-500" />
            <h3 className="font-bold text-ink-800 text-lg">Notificações</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-ink-400 hover:bg-ink-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.enabled ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-400'}`}>
                {settings.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-800">Alerta Sonoro</p>
                <p className="text-xs text-ink-400">Tocar som ao receber novo pedido</p>
              </div>
            </div>
            <button
              onClick={() => update({ enabled: !settings.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-brand-500' : 'bg-ink-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Volume slider */}
          <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-ink-700">Volume</label>
              <span className="text-xs text-ink-400 font-mono">{Math.round(settings.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX size={16} className="text-ink-400 shrink-0" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(e) => update({ volume: parseFloat(e.target.value) })}
                className="flex-1 accent-brand-500"
              />
              <Volume2 size={16} className="text-ink-400 shrink-0" />
            </div>
          </div>

          {/* Sound selector */}
          <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
            <label className="text-sm font-semibold text-ink-700 mb-3 block">Som da Notificação</label>
            <div className="space-y-2">
              {soundOptions.map((sound: SoundType) => (
                <button
                  key={sound}
                  onClick={() => update({ sound })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                    settings.sound === sound
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-200 text-ink-600 hover:border-brand-300'
                  }`}
                >
                  <span className="text-sm font-medium">{soundLabels[sound]}</span>
                  {settings.sound === sound && (
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview button */}
          <button
            onClick={preview}
            disabled={!settings.enabled}
            className="btn-ghost w-full justify-center"
          >
            <Play size={16} />
            Testar Som
          </button>

          {/* Info */}
          <div className="bg-ink-50 rounded-xl p-4">
            <p className="text-xs text-ink-500 leading-relaxed">
              O alerta sonoro toca automaticamente quando um novo pedido de delivery é recebido.
              O som toca apenas uma vez por pedido e não se repete ao recarregar a página.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
