// Smith — Demo news articles
//
// LOAD-BEARING FOR DEMO ONLY. These are fake, hand-authored stubs used when
// the news_articles table is empty (typically right after `npm run reset`
// before you've run `npm run ingest`).
//
// Once you've ingested real RSS, these don't need to come back. The seeder
// (called from seed.js) only inserts them if no articles exist.

import { q } from './db.js';

const NOW = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Each article picks one of the photo placeholder kinds for visual variety.
// time_ago is in hours, converted to a real timestamp at insert time.
const DEMO = [
  // THE TRADE
  { cat: 'The Trade', tags: ['Wages', 'Hiring'],         hours_ago: 4,    src: 'Construction Dive',     title: 'Skilled trade wages outpace inflation as labor shortage tightens',                            url: 'https://www.constructiondive.com/news/skilled-trade-wages-2026/', summary: 'Construction-sector wages rose 7.2% year-over-year, with carpenters and electricians leading gains amid a persistent labor shortage.', image_kind: 'frame',    featured: true,  read: 4 },
  { cat: 'The Trade', tags: [],                          hours_ago: 18,   src: 'ENR — Engineering News-Record',         title: 'US housing starts rebound 3.4% in Q2 after sluggish spring',                                  url: 'https://www.enr.com/articles/housing-starts-q2-2026/',            summary: 'Single-family permits drove the gain, with the Mountain West region showing the strongest activity.', image_kind: 'frame',    featured: false, read: 5 },
  { cat: 'The Trade', tags: ['Tariffs', 'Materials'],    hours_ago: 30,   src: 'Construction Executive',                title: 'Steel tariffs add $0.18/sqft to commercial framing, contractors say',                         url: 'https://www.constructionexec.com/article/steel-tariffs-2026/',    summary: 'A new round of tariffs is pushing project bids higher, with mid-size GCs squeezed hardest.', image_kind: 'steel',    featured: false, read: 3 },

  // CAREER
  { cat: 'Career', tags: ['Apprenticeship'],             hours_ago: 8,    src: 'ENR Workforce',                         title: 'Apprenticeship enrollment hits 10-year high as trades compete with tech for grads',          url: 'https://www.enr.com/articles/apprentice-enrollment-2026/',        summary: 'Building trades report a 28% surge in apprentice applications, driven by union outreach and rising wage signals.', image_kind: 'crew',     featured: true,  read: 6 },
  { cat: 'Career', tags: ['Hiring'],                     hours_ago: 22,   src: 'Construction Citizen',                  title: 'How to write a foreman résumé that actually gets read',                                       url: 'https://constructioncitizen.com/article/foreman-resume/',         summary: 'Practical advice from three field PMs on what they look for, and what gets a résumé tossed.', image_kind: 'crew',     featured: false, read: 7 },
  { cat: 'Career', tags: ['Wages'],                      hours_ago: 50,   src: 'Construction Dive',                     title: 'Journeyman electrician pay tops $95K in five major metros',                                   url: 'https://www.constructiondive.com/news/electrician-pay-2026/',     summary: 'BLS data shows San Francisco, NYC, Seattle, Boston and DC leading the journeyman wage tables.', image_kind: 'workshop', featured: false, read: 4 },

  // MATERIALS
  { cat: 'Materials', tags: ['Materials'],               hours_ago: 6,    src: 'Equipment World',                       title: 'Lumber futures slip 6% as housing demand softens into summer',                                url: 'https://www.equipmentworld.com/news/lumber-futures-2026/',        summary: 'Softwood lumber pulled back from spring highs; analysts split on whether the dip holds through Q3.', image_kind: 'wood',     featured: false, read: 3 },
  { cat: 'Materials', tags: ['Concrete & Masonry'],      hours_ago: 36,   src: 'Concrete Construction',                 title: 'Self-healing concrete moves from lab to real bridge decks',                                   url: 'https://www.concreteconstruction.net/news/self-healing-2026/',    summary: 'A pilot program in Iowa is the first U.S. infrastructure deployment of the bacteria-infused mix.', image_kind: 'concrete', featured: true,  read: 5 },
  { cat: 'Materials', tags: ['Sustainability'],          hours_ago: 60,   src: 'Architectural Record',                  title: 'Cross-laminated timber gains traction for mid-rise mixed-use',                                url: 'https://www.architecturalrecord.com/articles/clt-2026/',          summary: 'CLT projects are now permitted up to 18 stories in 14 states. Bozeman approves its first.', image_kind: 'wood',     featured: false, read: 6 },

  // LABOR
  { cat: 'Labor', tags: ['Wages', 'Labor'],              hours_ago: 12,   src: 'AGC of America News',                   title: 'Construction wage growth outpaces overall private sector for 14th straight month',           url: 'https://www.agc.org/news/wage-growth-2026/',                      summary: 'AGC analysis shows trades wage growth at 5.8% vs 3.9% for the broader private sector.', image_kind: 'crew',     featured: false, read: 4 },
  { cat: 'Labor', tags: ['Labor', 'Hiring'],             hours_ago: 28,   src: 'ABC News Releases',                     title: 'Open construction jobs fall to 320K — first dip in 18 months',                                url: 'https://www.abc.org/news/job-openings-2026/',                     summary: 'Easing slightly from 414K peak, though analysts caution against reading the slowdown as relief.', image_kind: 'crew',     featured: false, read: 3 },
  { cat: 'Labor', tags: ['Apprenticeship'],              hours_ago: 80,   src: 'BLS Construction',                      title: 'BLS: women now make up 11.2% of construction workforce',                                      url: 'https://www.bls.gov/news.release/blgs-women-2026.htm',            summary: 'Up from 10.4% a year ago; gains concentrated in inspection, project management, and electrical.', image_kind: 'crew',     featured: false, read: 4 },

  // SAFETY
  { cat: 'Safety', tags: ['Safety'],                     hours_ago: 14,   src: 'OSHA News Releases',                    title: 'OSHA finalizes heat illness rule — June 1 effective date',                                    url: 'https://www.osha.gov/news/newsreleases/national/heat-2026',       summary: 'New rule mandates water, shade and rest breaks for outdoor work above 80°F. Applies to crews of 5+.', image_kind: 'sky',      featured: true,  read: 5 },
  { cat: 'Safety', tags: ['Safety'],                     hours_ago: 42,   src: 'CPWR Research',                         title: 'Fall fatalities tick down 8% as fall-protection enforcement steps up',                        url: 'https://www.cpwr.com/research/fall-fatalities-2026/',             summary: 'CPWR\'s annual report shows the first measurable drop in residential fall deaths since 2019.', image_kind: 'roof',     featured: false, read: 6 },

  // CODES
  { cat: 'Codes', tags: ['Codes'],                       hours_ago: 24,   src: 'ICC Public News',                       title: '2024 IBC adoption hits 38 states — what changes for residential GCs',                         url: 'https://www.iccsafe.org/news/ibc-adoption-2026/',                 summary: 'Notable shifts in egress, energy and EV-readiness; key date markers for compliance in the holdout states.', image_kind: 'blueprint',featured: true,  read: 7 },
  { cat: 'Codes', tags: ['Codes', 'Energy'],             hours_ago: 70,   src: 'ICC Public News',                       title: 'New mass timber Type IV-B provisions push commercial mid-rise frontier',                      url: 'https://www.iccsafe.org/news/timber-iv-b-2026/',                  summary: 'Code amendments approved last month enable Type IV-B buildings up to 12 stories.', image_kind: 'wood',     featured: false, read: 5 },

  // TECH & AI
  { cat: 'Tech & AI', tags: ['AI', 'Technology'],        hours_ago: 5,    src: 'BuiltWorlds',                           title: 'Procore launches AI takeoff that reads PDF blueprints in 90 seconds',                         url: 'https://builtworlds.com/news/procore-ai-takeoff-2026/',           summary: 'The first major estimating tool with usable LLM-driven plan reading; early users report 40% faster bid prep.', image_kind: 'blueprint',featured: true,  read: 4 },
  { cat: 'Tech & AI', tags: ['Robotics'],                hours_ago: 16,   src: 'Construction Dive — Tech',              title: 'Bricklaying robot deployed on real commercial site in Houston',                               url: 'https://www.constructiondive.com/news/sam100-houston-2026/',      summary: 'SAM100 laid 12,000 bricks over two weeks; the GC says the math finally pencils for retrofit corridors.', image_kind: 'brick',    featured: false, read: 5 },
  { cat: 'Tech & AI', tags: ['BIM', 'Technology'],       hours_ago: 38,   src: 'AEC Magazine',                          title: 'Autodesk Forma rolls out generative early-stage massing for residential',                     url: 'https://aecmag.com/news/forma-generative-2026/',                  summary: 'The browser-based tool now spits out 25-50 site-massing variants in under a minute, with daylight and zoning constraints baked in.', image_kind: 'blueprint',featured: false, read: 6 },
  { cat: 'Tech & AI', tags: ['AI'],                      hours_ago: 64,   src: 'BuiltWorlds',                           title: 'Where construction-AI hype meets jobsite reality: a practitioner roundtable',                  url: 'https://builtworlds.com/podcast/ai-roundtable-2026/',             summary: 'Six site supers and PMs on what\'s working (takeoff, scheduling), what\'s noise (chatbots), and what\'s next.', image_kind: 'crew',     featured: false, read: 8 },
];

export async function seedDemoArticlesIfEmpty() {
  const { rows } = await q(`SELECT COUNT(*)::int AS n FROM news_articles`);
  if (rows[0].n > 0) {
    console.log(`[seed-news] skipping — ${rows[0].n} article(s) already present`);
    return;
  }
  for (const a of DEMO) {
    await q(
      `INSERT INTO news_articles
         (title, summary, source, source_url, published_at,
          read_minutes, image_kind, category, tags, featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (source_url) DO NOTHING`,
      [
        a.title, a.summary, a.src, a.url,
        new Date(NOW - a.hours_ago * HOUR),
        a.read, a.image_kind, a.cat, a.tags, !!a.featured,
      ]
    );
  }
  console.log(`[seed-news] inserted ${DEMO.length} demo article(s)`);
}
