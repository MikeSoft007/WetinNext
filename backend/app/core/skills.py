"""Small, versioned taxonomy: labels are text signals, never verified proficiency."""

import re

ALIASES = {
    "Nursing": ["nursing", "nurse", "midwifery"],
    "Anatomy": ["anatomy", "physiology", "body systems"],
    "Patient safety": ["patient safety"],
    "Infection prevention": ["infection prevention", "infection control"],
    "Public health": ["public health", "global health"],
    "Caregiving": ["caregiving", "caregiver"],
    "Teaching": ["teaching", "teacher", "pedagogy"],
    "Accounting": ["accounting", "bookkeeping"],
    "Food safety": ["food safety", "food hygiene"],
    "Networking": ["networking", "tcp/ip", "dns", "routing", "switching"],
    "Linux": ["linux", "ubuntu"],
    "Server hardware": [
        "server hardware",
        "rack",
        "cabling",
        "data center",
        "data centre",
        "datacenter",
        "datacentre",
    ],
    "Cloud infrastructure": ["cloud infrastructure", "azure", "aws"],
    "Digital literacy": ["digital literacy", "digital skills"],
    "Research": ["research"],
    "Cybersecurity": ["cybersecurity", "cyber security", "information security"],
    "Artificial intelligence": ["artificial intelligence", "machine learning"],
    "Marketing": ["marketing", "digital marketing"],
    "Customer support": ["customer support", "customer service"],
    "Project management": ["project management"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript"],
    "React": ["react", "reactjs"],
    "Python": ["python"],
    "SQL": ["sql", "postgresql", "mysql"],
    "Spreadsheets": ["spreadsheets", "spreadsheet", "excel", "google sheets"],
    "Git": ["git", "github"],
    "REST API": ["rest api", "restful", "apis", "api"],
    "Communication": ["communication", "communicating"],
    "Data analysis": ["data analysis", "data analytics"],
    "Node.js": ["node.js", "nodejs"],
    "Testing": ["testing", "unit tests", "pytest"],
}
TRACKS = {
    "infrastructure": {
        "name": "Data centre and infrastructure foundations",
        "skills": ["Networking", "Linux", "Server hardware", "Cloud infrastructure"],
        "keywords": [
            "data center",
            "data centre",
            "datacenter",
            "datacentre",
            "infrastructure engineer",
            "network engineer",
            "systems administrator",
        ],
    },
    "cybersecurity": {
        "name": "Cybersecurity foundations",
        "skills": ["Cybersecurity", "Research", "Communication"],
        "keywords": ["cybersecurity", "cyber security", "information security"],
    },
    "marketing": {
        "name": "Digital marketing",
        "skills": ["Marketing", "Communication", "Research"],
        "keywords": ["marketing", "content creator", "social media"],
    },
    "support": {
        "name": "Customer support",
        "skills": ["Customer support", "Communication", "Digital literacy"],
        "keywords": ["customer support", "customer service", "virtual assistant"],
    },
    "project": {
        "name": "Project coordination",
        "skills": ["Project management", "Communication", "Spreadsheets"],
        "keywords": [
            "project management",
            "project coordinator",
            "project coordination",
            "programme officer",
            "program officer",
        ],
    },
    "scholarship": {
        "name": "Scholarship preparation",
        "skills": ["Research", "Communication"],
        "keywords": ["scholarship", "bursary", "study loan", "postgraduate study"],
    },
    "foundation": {
        "name": "Digital foundations",
        "skills": ["Digital literacy", "Research", "Communication"],
        "keywords": [],
    },
    "frontend": {
        "name": "Frontend development",
        "skills": ["HTML", "CSS", "JavaScript", "Git"],
        "keywords": [
            "frontend",
            "front-end",
            "front end",
            "web design",
            "react",
            "javascript",
            "html",
            "css",
        ],
    },
    "backend": {
        "name": "Backend development",
        "skills": ["Python", "REST API", "Testing", "Git"],
        "keywords": [
            "backend",
            "back-end",
            "back end",
            "rest api",
            "server",
            "flask",
            "django",
        ],
    },
    "data": {
        "name": "Data fundamentals",
        "skills": ["Spreadsheets", "SQL", "Data analysis"],
        "keywords": [
            "data",
            "data analysis",
            "data analytics",
            "data analyst",
            "data science",
            "spreadsheet",
            "excel",
            "reporting",
        ],
    },
}


def skills_in(text):
    return [
        skill
        for skill, aliases in ALIASES.items()
        if any(
            re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", text.casefold())
            for alias in aliases
        )
    ]


def track_for(profile):
    explicit = profile.get("career_track", "auto")
    if explicit in TRACKS:
        return explicit
    text = profile.get("goal", "").casefold()
    # Specific role phrases must take precedence over the standalone word data.
    if any(word in text for word in TRACKS["infrastructure"]["keywords"]):
        return "infrastructure"
    scored = {
        name: sum(word in text for word in spec["keywords"])
        for name, spec in TRACKS.items()
    }
    return max(scored, key=scored.get) if any(scored.values()) else "foundation"
