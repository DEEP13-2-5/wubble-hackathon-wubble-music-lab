const INDUSTRY_SEGMENTS = [
  {
    key: "marketing-ads",
    label: "Marketing & Ads",
    headline: "Go from campaign brief to launch-ready audio fast",
    description: "Generate, test, and localize ad music variants for short-form, social, and performance campaigns.",
    quickUseCases: ["Brand campaigns", "Social ads", "Regional adaptation"],
    ctaLabel: "Explore marketing workflow"
  },
  {
    key: "film-tv",
    label: "Film & TV",
    headline: "Draft and refine scene-ready sonic direction",
    description: "Create quick score directions for mood boards, scene drafts, and iterative edit reviews.",
    quickUseCases: ["Scene mood drafting", "Trailer cue ideation", "Version comparison"],
    ctaLabel: "Explore production workflow"
  },
  {
    key: "game-dev",
    label: "Game Dev",
    headline: "Prototype adaptive music concepts for gameplay loops",
    description: "Build and compare soundtrack directions for levels, events, and thematic progression.",
    quickUseCases: ["Level themes", "Boss encounter mood", "Event stingers"],
    ctaLabel: "Explore game workflow"
  },
  {
    key: "hospitality",
    label: "Hospitality",
    headline: "Shape consistent sonic identity across locations",
    description: "Generate curated ambience styles for dining, retail, and premium customer experience zones.",
    quickUseCases: ["In-store ambience", "Seasonal playlists", "Brand-consistent mood"],
    ctaLabel: "Explore hospitality workflow"
  },
  {
    key: "creators",
    label: "Creators",
    headline: "Scale content production with fast music iteration",
    description: "Produce royalty-safe music options tailored for content format, platform, and audience style.",
    quickUseCases: ["Short-form videos", "Podcast intros", "Creator series themes"],
    ctaLabel: "Explore creator workflow"
  },
  {
    key: "podcasters",
    label: "Podcasters",
    headline: "Create episode-ready intros, transitions, and themes",
    description: "Generate and iterate sonic branding assets for episodes, chapters, and recurring segments.",
    quickUseCases: ["Intro themes", "Transition cues", "Segment branding"],
    ctaLabel: "Explore podcast workflow"
  }
];

function normalizeIndustryKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function getLandingContent(industryKey) {
  const requestedKey = normalizeIndustryKey(industryKey);
  const defaultIndustry = INDUSTRY_SEGMENTS[0];
  const activeIndustry = INDUSTRY_SEGMENTS.find((item) => item.key === requestedKey) || defaultIndustry;

  return {
    hero: {
      productName: "Wubble Music Lab",
      headline: "Enterprise AI music workflows for business teams",
      subheadline: "Generate, review, and deploy royalty-safe music across campaigns in minutes.",
      promptPlaceholder: "Describe the brand mood, audience, and campaign goal...",
      capabilityTabs: ["Music", "Voice", "SFX"]
    },
    sectors: {
      tabs: INDUSTRY_SEGMENTS.map((item) => ({ key: item.key, label: item.label })),
      activeKey: activeIndustry.key,
      activeCard: activeIndustry
    }
  };
}
