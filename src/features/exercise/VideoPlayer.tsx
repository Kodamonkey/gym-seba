import { useEffect, useRef, useState } from 'react';
import type { ExternalMedia } from '../../domain/media';

/**
 * Reproductor para medios externos autorizados (MP4/WebM/GIF). Solo ofrece los controles
 * que el recurso declara y el formato permite: un GIF no tiene controles de vídeo,
 * y un vídeo con color integrado no permite ocultar músculos.
 */
export function VideoPlayer({ media, label }: { media: ExternalMedia; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const isGif = media.mediaType === 'image/gif';

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);

  if (isGif) {
    return (
      <figure className="flex flex-col gap-1">
        <img src={media.sourceUrl ?? ''} alt={`Demostración: ${label}`} loading="lazy" className="w-full rounded-xl border border-line" onError={() => setError('No se pudo cargar la imagen.')} />
        <figcaption className="text-xs text-faint">
          {media.attribution || media.provider} · {media.license}
        </figcaption>
        {error && <p className="text-sm text-danger">{error}</p>}
      </figure>
    );
  }

  return (
    <figure className="flex flex-col gap-1">
      <video
        ref={ref}
        src={media.sourceUrl ?? undefined}
        preload="metadata"
        playsInline
        muted
        loop
        controls={media.capabilities.pause}
        className="w-full rounded-xl border border-line bg-black"
        aria-label={`Demostración: ${label}`}
        crossOrigin="anonymous"
        onError={() => setError('No se pudo cargar el vídeo (sin conexión, formato no compatible o el proveedor no permite este uso). El registro de series sigue disponible.')}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {media.capabilities.restart && (
          <button
            type="button"
            className="h-11 rounded-lg bg-surface-3 px-3"
            onClick={() => {
              if (ref.current) {
                ref.current.currentTime = 0;
                void ref.current.play().catch(() => undefined);
              }
            }}
          >
            ↺ Reiniciar
          </button>
        )}
        {media.capabilities.speed && (
          <select aria-label="Velocidad de reproducción" className="h-11 rounded-lg bg-surface-3 px-2" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            {[0.5, 0.75, 1].map((r) => (
              <option key={r} value={r}>
                {String(r).replace('.', ',')}×
              </option>
            ))}
          </select>
        )}
      </div>
      <figcaption className="text-xs text-faint">
        {media.attribution || media.provider} · {media.license} · conexión a terceros: {new URL(media.sourceUrl ?? 'about:blank', location.href).host || 'local'}
      </figcaption>
      {error && <p className="text-sm text-danger">{error}</p>}
    </figure>
  );
}
