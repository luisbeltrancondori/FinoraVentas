import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { assetUrl } from '../api.js';

export default function HeroCarousel({ banners, businessName, loading = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState({ signature: '', ready: false });
  const hasBanners = banners.length > 0;
  const bannerSignature = banners.map((banner) => `${banner.id}:${banner.imagen_url}`).join('|');
  const waitingForImages = hasBanners
    && (preloadedImages.signature !== bannerSignature || !preloadedImages.ready);

  useEffect(() => {
    setActiveIndex(0);
  }, [banners]);

  useEffect(() => {
    if (!banners.length) {
      setPreloadedImages({ signature: '', ready: false });
      return undefined;
    }

    let active = true;
    let remaining = banners.length;
    setPreloadedImages({ signature: bannerSignature, ready: false });

    const markImageReady = () => {
      remaining -= 1;
      if (remaining === 0 && active) {
        setPreloadedImages({ signature: bannerSignature, ready: true });
      }
    };
    const images = banners.map((banner) => {
      const image = new Image();
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        markImageReady();
      };
      image.onload = settle;
      image.onerror = settle;
      image.src = assetUrl(banner.imagen_url);
      if (image.complete) settle();
      return image;
    });

    return () => {
      active = false;
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [banners, bannerSignature]);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  function move(direction) {
    setActiveIndex((current) => (current + direction + banners.length) % banners.length);
  }

  if (loading || waitingForImages) {
    return (
      <section
        aria-label="Cargando promociones"
        aria-busy="true"
        className="min-h-64 animate-pulse rounded-[1.75rem] bg-slate-100 sm:min-h-80 lg:min-h-[25rem]"
      />
    );
  }

  return (
    <section aria-label="Promociones de la tienda" aria-roledescription="carrusel" className={`relative isolate overflow-hidden rounded-[1.75rem] ${hasBanners ? 'min-h-64 bg-slate-900 sm:min-h-80 lg:min-h-[25rem]' : 'border border-emerald-100/80 bg-gradient-to-br from-emerald-50 via-white to-slate-100 px-6 py-10 sm:px-10 sm:py-14 lg:px-16'}`}>
      {hasBanners ? <>
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${index + 1} de ${banners.length}`}
            aria-hidden={index !== activeIndex}
            className={`absolute inset-0 transition-opacity duration-700 ${index === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <img src={assetUrl(banner.imagen_url)} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        {banners.length > 1 && <>
          <button type="button" onClick={() => move(-1)} aria-label="Banner anterior" className="absolute left-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur transition hover:bg-black/50 sm:left-4 sm:h-10 sm:w-10"><ArrowLeft size={17} /></button>
          <button type="button" onClick={() => move(1)} aria-label="Banner siguiente" className="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur transition hover:bg-black/50 sm:right-4 sm:h-10 sm:w-10"><ArrowRight size={17} /></button>
        </>}
        {banners.length > 1 && <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((banner, index) => (
            <button key={banner.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Mostrar banner ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined} className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/60 hover:bg-white'}`} />
          ))}
        </div>}
      </> : <>
        <div aria-hidden="true" className="absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            <ShieldCheck size={14} /> Tu tienda de confianza
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            ¡Bienvenido a {businessName || 'Tienda Forty'}! <span className="text-emerald-700">Todo lo que necesitas para tu hogar.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Descubre nuestras ofertas exclusivas de la semana.</p>
          <a href="#ofertas" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-800">
            Ver ofertas <ArrowRight size={16} />
          </a>
        </div>
        <div aria-hidden="true" className="absolute -bottom-16 -right-6 hidden h-64 w-64 items-center justify-center rounded-full border border-emerald-200/70 text-emerald-100 md:flex">
          <span className="h-48 w-48 rounded-full border border-emerald-200/70" />
          <span className="absolute h-32 w-32 rounded-full border border-emerald-200/70" />
        </div>
      </>}
    </section>
  );
}
