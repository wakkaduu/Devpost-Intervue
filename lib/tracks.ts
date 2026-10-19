// The 52 interview tracks, grouped by field. Track names are the keys of data/questions.json.

export interface Track {
  /** Exact key in data/questions.json. */
  name: string;
  icon: string;
}

export interface TrackGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  tracks: Track[];
}

export const TRACK_GROUPS: TrackGroup[] = [
  {
    "id": "tech",
    "name": "Tech & Software Engineering",
    "icon": "💻",
    "description": "Backend, Frontend, Mobile, Full-Stack, Architecture, DevOps, Security, QA, and Site Reliability",
    "tracks": [
      {
        "name": "Software Engineer / Backend Developer (Data structures, algorithms, API design, database optimization)",
        "icon": "💻"
      },
      {
        "name": "Frontend Engineer / UI Developer (Component lifecycle, state management, CSS layouts, web performance)",
        "icon": "🎨"
      },
      {
        "name": "Mobile App Developer - iOS / Android (App architecture, state management, memory management, offline storage)",
        "icon": "📱"
      },
      {
        "name": "Full-Stack Engineer (End-to-end architecture, cross-stack integration, system trade-offs)",
        "icon": "🌐"
      },
      {
        "name": "Systems Architect / Principal Engineer (Scalability, high availability, microservices, distributed systems)",
        "icon": "🏗️"
      },
      {
        "name": "DevOps / Infrastructure / SRE Engineer (CI/CD pipelines, container orchestration, terraform, incident response)",
        "icon": "⚙️"
      },
      {
        "name": "Cybersecurity Analyst / Penetration Tester (Threat modeling, vulnerability assessment, incident handler scenarios)",
        "icon": "🛡️"
      },
      {
        "name": "Quality Assurance (QA) / Test Automation Engineer (Test strategy, automated framework design, boundary case identification)",
        "icon": "🧪"
      },
      {
        "name": "Site Reliability / Field Service Engineer (On-site diagnostics, equipment troubleshooting, safety protocols)",
        "icon": "🔧"
      }
    ]
  },
  {
    "id": "data",
    "name": "Data, Analytics & AI",
    "icon": "🤖",
    "description": "Data pipelines, machine learning, statistical inference, and business intelligence",
    "tracks": [
      {
        "name": "Data Engineer (ETL pipelines, data warehousing, query performance tuning, data modeling)",
        "icon": "🗄️"
      },
      {
        "name": "Data Scientist / Machine Learning Engineer (Model evaluation, feature engineering, statistical inference, live coding)",
        "icon": "🤖"
      },
      {
        "name": "Business Analyst / BI Developer (SQL proficiency, dashboard design, stakeholder requirement gathering)",
        "icon": "📉"
      }
    ]
  },
  {
    "id": "product",
    "name": "Product, Design & Agile",
    "icon": "🚀",
    "description": "Product vision, agile execution, and user experience research & design systems",
    "tracks": [
      {
        "name": "Product Manager (Product vision, metric prioritization, UI/UX critique, feature trade-offs)",
        "icon": "🚀"
      },
      {
        "name": "Technical Program Manager / Scrum Master (Agile processes, cross-functional alignment, timeline risk management)",
        "icon": "⏱️"
      },
      {
        "name": "UX/UI Designer & Researcher (Design portfolio review, user testing methodology, design system implementation)",
        "icon": "✏️"
      }
    ]
  },
  {
    "id": "business",
    "name": "Strategy, Finance & Leadership",
    "icon": "📈",
    "description": "Management consulting cases, investment banking, financial analysis, corporate ops, and C-Suite",
    "tracks": [
      {
        "name": "Management Consultant (Market entry cases, profitability analysis, framework selection, brain teasers)",
        "icon": "💼"
      },
      {
        "name": "Investment Banking Analyst / Associate (DCF valuation, financial statement modeling, M&A mechanics)",
        "icon": "📈"
      },
      {
        "name": "Financial Analyst / Accountant (Budget forecasting, variance analysis, compliance regulations)",
        "icon": "📊"
      },
      {
        "name": "Corporate Strategy / Operations Manager (Supply chain optimization, unit economics, process mapping)",
        "icon": "♟️"
      },
      {
        "name": "Executive / C-Suite Leadership - CEO/CTO/CFO (Vision alignment, board management, capital allocation strategies)",
        "icon": "👑"
      }
    ]
  },
  {
    "id": "sales",
    "name": "Sales, Marketing & Comms",
    "icon": "🎯",
    "description": "Enterprise sales, cold outreach, growth marketing, copywriting, and PR crisis communication",
    "tracks": [
      {
        "name": "Enterprise Account Executive (B2B sales strategy, objection handling, live deal closing roleplay)",
        "icon": "👔"
      },
      {
        "name": "Business Development Representative (BDR/SDR) (Live cold calling, lead qualification, value proposition delivery)",
        "icon": "📞"
      },
      {
        "name": "Digital Marketing Specialist / Growth Marketer (Customer acquisition cost optimization, A/B test design, campaign ROI)",
        "icon": "📣"
      },
      {
        "name": "Content Strategist / Copywriter (Brand voice alignment, content distribution strategy, copywriting exercise)",
        "icon": "✍️"
      },
      {
        "name": "PR & Communications Manager (Crisis management roleplays, media statement drafting, brand reputation)",
        "icon": "🎙️"
      }
    ]
  },
  {
    "id": "people",
    "name": "People, Support & Psychology",
    "icon": "👥",
    "description": "HRBP, talent acquisition, customer success, technical helpdesk, clinical and I/O psychology",
    "tracks": [
      {
        "name": "Human Resources Business Partner (HRBP) (Employee relations, performance management, conflict mediation)",
        "icon": "👥"
      },
      {
        "name": "Technical Recruiter / Talent Acquisition Specialist (Sourcing strategy, candidate assessment, hiring manager alignment)",
        "icon": "🔍"
      },
      {
        "name": "Customer Success Manager / Account Manager (Client retention strategies, upsell positioning, de-escalation roleplays)",
        "icon": "🤝"
      },
      {
        "name": "Customer Support / Helpdesk Specialist (Live troubleshooting, empathy checks, ticketing workflow execution)",
        "icon": "🎧"
      },
      {
        "name": "Clinical Psychologist / Staff Therapist (Case conceptualization, ethical dilemmas, risk assessment)",
        "icon": "🧠"
      },
      {
        "name": "Industrial-Organizational Psychologist (Selection tool validation, change management, organizational assessment)",
        "icon": "🏢"
      }
    ]
  },
  {
    "id": "general",
    "name": "General & Foundational",
    "icon": "💼",
    "description": "Core behavioral, cultural fit, situational, and vocal communication interviews",
    "tracks": [
      {
        "name": "Behavioral",
        "icon": "🎯"
      },
      {
        "name": "Cultural Fit",
        "icon": "🤝"
      },
      {
        "name": "Situational",
        "icon": "⚡"
      },
      {
        "name": "Communication & Presence",
        "icon": "🗣️"
      }
    ]
  },
  {
    "id": "healthcare",
    "name": "Medicine & Healthcare",
    "icon": "🩺",
    "description": "Admissions, multiple mini interviews, and medical residency matching",
    "tracks": [
      {
        "name": "Medical & Health Sciences Programs (MBBS, MD, Nursing, Dentistry)",
        "icon": "🩺"
      },
      {
        "name": "Multiple Mini Interviews (MMI)",
        "icon": "🏥"
      },
      {
        "name": "Medical Residency & Fellowship Matching",
        "icon": "👨‍⚕️"
      }
    ]
  },
  {
    "id": "academic",
    "name": "Admissions & Academia",
    "icon": "🎓",
    "description": "Law, MBA, PhD defenses, Oxbridge/Ivy League, scholarships, and study abroad",
    "tracks": [
      {
        "name": "Law Degree Programs (Juris Doctor, LLB)",
        "icon": "⚖️"
      },
      {
        "name": "MBA & Graduate Business School Admissions",
        "icon": "🎓"
      },
      {
        "name": "PhD & Master’s Thesis/Research Proposal Defenses",
        "icon": "🔬"
      },
      {
        "name": "Undergraduate Competitive University Programs (Oxbridge, Ivy League)",
        "icon": "🏛️"
      },
      {
        "name": "Academic Scholarship & Grant Applications",
        "icon": "📜"
      },
      {
        "name": "Study Abroad & Student Exchange Programs",
        "icon": "✈️"
      }
    ]
  },
  {
    "id": "public",
    "name": "Government, Defense & Public Service",
    "icon": "🏛️",
    "description": "Civil service, military selection boards, law enforcement, and visa clearances",
    "tracks": [
      {
        "name": "Visa & Immigration Clearances (Student, Work, Permanent Residency)",
        "icon": "🛂"
      },
      {
        "name": "Civil Service & Government Agency Appointments",
        "icon": "🏛️"
      },
      {
        "name": "Military & Defense Officer Selection Boards",
        "icon": "🎖️"
      },
      {
        "name": "Law Enforcement & Emergency Services Screening",
        "icon": "🚓"
      }
    ]
  },
  {
    "id": "competitions",
    "name": "Competitions, Media & Pitch",
    "icon": "🏆",
    "description": "Startup accelerators (YC), debate tournaments, pageants, and broadcast media",
    "tracks": [
      {
        "name": "Startup Pitch Competitions & Accelerator Entry (e.g., Y Combinator)",
        "icon": "💡"
      },
      {
        "name": "Competitive Debate & Model UN Selection",
        "icon": "🗣️"
      },
      {
        "name": "Beauty & Personality Pageants",
        "icon": "✨"
      },
      {
        "name": "Media, Journalism & Broadcast Screen Tests",
        "icon": "🎥"
      }
    ]
  }
];
