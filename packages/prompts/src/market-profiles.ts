export const MARKET_PROFILES = {
  germany: {
    tone_baseline: "Formal, precise, skeptical of hype, process-oriented",
    trust_markers: ["GDPR/DSGVO", "ISO certifications", "EU data residency", "SLA clarity"],
    red_flags: ["unlock", "revolutionary", "game-changer", "all-in-one"],
    cta_style: "Soft, non-committal: 'Demo anfragen', 'Unverbindlich beraten'",
    generic_cliches: ["seamless", "next-gen", "AI-powered", "best-in-class"]
  },
  poland: {
    tone_baseline: "Direct but fact-based, values concrete numbers and transparency",
    trust_markers: ["specific metrics", "transparent pricing", "technical specs", "implementation timeline"],
    red_flags: ["hype without data", "vague promises", "hidden pricing"],
    cta_style: "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
    generic_cliches: ["all-in-one", "unlock efficiency", "transform your business"]
  },
  brazil: {
    tone_baseline: "Warm, human, relationship-first, low-friction",
    trust_markers: ["Portuguese support", "local case studies", "WhatsApp contact", "sem compromisso", "LGPD"],
    red_flags: ["cold corporate tone", "aggressive push", "English-only support"],
    cta_style: "Human, frictionless: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
    generic_cliches: ["efficiency", "productivity", "enterprise-grade"]
  }
} as const;

export type MarketProfileKey = keyof typeof MARKET_PROFILES;
