"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

const INDIAN_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "bn", label: "বাংলা" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

export default function GoogleTranslate() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    // Define callback before loading script
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,hi,bn,ta,te,mr,gu,kn,ml,pa",
          autoDisplay: false,
        },
        "google_translate_element"
      );
    };

    // Load Google Translate script
    if (!document.getElementById("goog-translate-script")) {
      const script = document.createElement("script");
      script.id = "goog-translate-script";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const changeLanguage = (code: string) => {
    setLang(code);

    // Poll until Google's internal <select> is ready, then drive it
    const tryChange = (attempts: number) => {
      const googleSelect = document.querySelector(".goog-te-combo") as HTMLSelectElement;
      if (googleSelect) {
        googleSelect.value = code;
        googleSelect.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (attempts > 0) {
        setTimeout(() => tryChange(attempts - 1), 200);
      }
    };
    tryChange(10);
  };

  return (
    <>
      {/* 
        IMPORTANT: Google needs this div to be in DOM and measurable (not display:none).
        We position it off-screen so it's invisible but still functional. 
      */}
      <div
        id="google_translate_element"
        style={{ position: "absolute", top: "-9999px", left: "-9999px", visibility: "hidden" }}
      />

      {/* Our custom sleek dark dropdown */}
      <div className="flex items-center gap-1.5 bg-[#141518] border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/5 transition-colors shadow-sm">
        <Globe className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
        <select
          value={lang}
          onChange={(e) => changeLanguage(e.target.value)}
          className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer max-w-[90px]"
        >
          {INDIAN_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="bg-[#1a1b1e] text-white">
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Suppress Google's intrusive yellow banner & body shift */}
      <style>{`
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
        .goog-te-spinner-pos { display: none !important; }
        .VIpgJd-ZVi9od-aZ2wEe-wOHMyf { display: none !important; }
      `}</style>
    </>
  );
}
