RESOURCES = [
    {
        "id": "gcf-excel",
        "title": "Excel fundamentals",
        "provider": "Microsoft Support",
        "url": "https://support.microsoft.com/en-us/excel/",
        "format": "Guides + tutorials",
        "device": "laptop",
        "cost": "Free guides; tool access may vary",
        "review": "Provider link; individual lessons need editorial review",
    },
    {
        "id": "gcf-sheets",
        "title": "Google Sheets fundamentals",
        "provider": "Google Support",
        "url": "https://support.google.com/a/users/answer/9282959?hl=en",
        "format": "Guides + tutorials",
        "device": "phone or laptop",
        "cost": "Free guides; tool access may vary",
        "review": "Provider link; individual lessons need editorial review",
    },
]
# Synthetic examples are deliberately not presented as live public vacancies.
OPPORTUNITIES = [
    {
        "id": "sample-data",
        "title": "Data & Reporting Intern",
        "organisation": "Example organisation",
        "type": "Internship",
        "country": "Nigeria",
        "skills": ["Spreadsheets", "SQL"],
        "description": "Practise reviewing an internship that asks for spreadsheet reporting and introductory SQL.",
        "mandatory": "Current university student",
        "sample": True,
        "url": None,
        "deadline": None,
    },
    {
        "id": "sample-project",
        "title": "Community Data Challenge",
        "organisation": "Example community programme",
        "type": "Project",
        "country": "Rwanda",
        "skills": ["Spreadsheets", "Data visualisation"],
        "description": "Practise preparing a small analysis project and explaining your findings.",
        "mandatory": "Access to a spreadsheet tool",
        "sample": True,
        "url": None,
        "deadline": None,
    },
]

RESOURCES.extend(
    [
        {
            "id": "mdn-web",
            "title": "Learn web development",
            "provider": "MDN Web Docs",
            "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development",
            "format": "Text guides and exercises",
            "device": "laptop",
            "cost": "Free",
            "review": "Official provider overview; individual lesson review pending",
            "skills": ["HTML", "CSS", "JavaScript"],
        },
        {
            "id": "python-tutorial",
            "title": "The Python Tutorial",
            "provider": "Python Software Foundation",
            "url": "https://docs.python.org/3/tutorial/",
            "format": "Text tutorial",
            "device": "laptop",
            "cost": "Free",
            "review": "Official provider tutorial; prior programming familiarity is helpful",
            "skills": ["Python"],
        },
    ]
)
for resource in RESOURCES:
    if resource["id"] in ["gcf-excel", "gcf-sheets"]:
        resource["skills"] = ["Spreadsheets", "Data analysis"]


# Source-checked free provider resources; access and account requirements are explicit.
RESOURCES.extend(
    [
        {
            "id": "openlearn-digital",
            "title": "Digital skills: succeeding in a digital world",
            "provider": "The Open University",
            "url": "https://www.open.edu/openlearn/digital-computing/digital-skills-succeeding-digital-world/content-section-overview",
            "format": "Text course with activities",
            "device": "phone or laptop",
            "cost": "Free",
            "review": "Official free course; an optional account saves course progress. Practice activities may need computer access.",
            "skills": ["Digital literacy", "Communication", "Research"],
            "source": "OpenLearn",
        },
        {
            "id": "ibm-skillsbuild",
            "title": "Technology and career skills learning catalogue",
            "provider": "IBM SkillsBuild",
            "url": "https://skillsbuild.org/adult-learners",
            "format": "Mixed text and video courses",
            "device": "phone or laptop",
            "cost": "Free; registration required",
            "review": "Official free catalogue, not a specific lesson. Check course device requirements and video data usage.",
            "skills": [
                "Data analysis",
                "Cybersecurity",
                "Communication",
                "Artificial intelligence",
            ],
            "source": "IBM SkillsBuild",
        },
        {
            "id": "git-book",
            "title": "Pro Git: getting started and Git basics",
            "provider": "Git project",
            "url": "https://git-scm.com/book/en/v2",
            "format": "Text book and exercises",
            "device": "laptop",
            "cost": "Free",
            "review": "Official freely available book. Reading works on a phone; practical version-control exercises require a computer.",
            "skills": ["Git"],
            "source": "Git",
        },
        {
            "id": "postgres-tutorial",
            "title": "PostgreSQL SQL tutorial",
            "provider": "PostgreSQL Global Development Group",
            "url": "https://www.postgresql.org/docs/current/tutorial.html",
            "format": "Text tutorial and exercises",
            "device": "laptop",
            "cost": "Free",
            "review": "Official tutorial; practical exercises require access to PostgreSQL.",
            "skills": ["SQL"],
            "source": "PostgreSQL",
        },
    ]
)


RESOURCES.extend(
    [
        {
            "id": "ibm-security",
            "title": "Cybersecurity foundations: learning catalogue",
            "provider": "IBM SkillsBuild",
            "url": "https://skillsbuild.org/learning-catalog",
            "format": "Mixed text and video courses",
            "device": "phone or laptop",
            "cost": "Free; registration required",
            "review": "Official catalogue; select an introductory cybersecurity module. Individual modules and practical labs may require a computer. Videos use data.",
            "skills": ["Cybersecurity", "Research"],
            "source": "IBM SkillsBuild",
        },
        {
            "id": "ibm-career",
            "title": "Workplace and career skills",
            "provider": "IBM SkillsBuild",
            "url": "https://skillsbuild.org/adult-learners",
            "format": "Mixed text and video catalogue",
            "device": "phone or laptop",
            "cost": "Free; registration required",
            "review": "Official catalogue; select a communication/customer-engagement module. Not a specific lesson. Videos use data.",
            "skills": ["Communication", "Customer support", "Digital literacy"],
            "source": "IBM SkillsBuild",
        },
        {
            "id": "hubspot-marketing",
            "title": "Digital marketing fundamentals",
            "provider": "HubSpot Academy",
            "url": "https://academy.hubspot.com/courses/digital-marketing",
            "format": "Video course and exercises",
            "device": "phone or laptop",
            "cost": "Free; registration required",
            "review": "Official free course; video uses data. Portfolio exercises can be drafted offline; no paid ads required.",
            "skills": ["Marketing", "Communication"],
            "source": "HubSpot Academy",
        },
        {
            "id": "openlearn-project",
            "title": "Project management: the start of the project journey",
            "provider": "The Open University",
            "url": "https://www.open.edu/openlearn/money-business/leadership-management/project-management-the-start-the-project-journey",
            "format": "Text course and activities",
            "device": "phone or laptop",
            "cost": "Free",
            "review": "Official introductory course; optional account saves progress. Draft planning activities using a document or spreadsheet.",
            "skills": ["Project management", "Communication"],
            "source": "OpenLearn",
        },
    ]
)

RESOURCES.extend(
    [
        {
            "id": "ms-data-analytics",
            "title": "Get started with Microsoft data analytics",
            "provider": "Microsoft Learn",
            "url": "https://learn.microsoft.com/en-us/training/paths/data-analytics-microsoft/",
            "format": "Text modules and exercises",
            "device": "laptop",
            "cost": "Free training; product and certification fees may apply",
            "review": "Official learning path. Reading works on a phone; practical Power BI/Fabric work may need Windows, an account or licensed services. Start with the introductory module.",
            "skills": ["Data analysis"],
            "source": "Microsoft Learn",
        },
        {
            "id": "harvard-cs50p",
            "title": "CS50 Introduction to Programming with Python",
            "provider": "Harvard CS50",
            "url": "https://cs50.harvard.edu/python/",
            "format": "Video, notes and programming exercises",
            "device": "laptop",
            "cost": "Free OpenCourseWare; optional verified certificates cost extra",
            "review": "Official course for beginners. Ten-week course: a four-week sprint covers selected lessons, not the whole course. Video is data-intensive; submissions require account access.",
            "skills": ["Python", "Testing"],
            "source": "Harvard CS50",
        },
        {
            "id": "mit-python",
            "title": "Introduction to computer science and programming in Python",
            "provider": "MIT OpenCourseWare",
            "url": "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/",
            "format": "Lecture notes, video and problem sets",
            "device": "laptop",
            "cost": "Free",
            "review": "Official archived university course; Python/tool versions may need adaptation. Use text notes for lower data use. No course credit or certificate implied.",
            "skills": ["Python"],
            "source": "MIT OpenCourseWare",
        },
        {
            "id": "openstax-marketing",
            "title": "Principles of Marketing",
            "provider": "OpenStax / Rice University",
            "url": "https://openstax.org/details/books/principles-marketing",
            "format": "Textbook online or PDF",
            "device": "phone or laptop",
            "cost": "Free digital textbook; print copies may cost extra",
            "review": "Official open textbook. Read individual chapters on a phone; downloading the full PDF uses more data. Examples may need adaptation to local markets.",
            "skills": ["Marketing", "Research"],
            "source": "OpenStax",
        },
    ]
)

RESOURCES.extend(
    [
        {
            "id": "ubuntu-server",
            "title": "Ubuntu Server tutorials and networking concepts",
            "provider": "Canonical",
            "url": "https://ubuntu.com/server/docs/tutorial/",
            "format": "Text documentation",
            "device": "phone or laptop",
            "cost": "Free documentation; a computer and optional VM download are needed for hands-on practice",
            "review": "Official server documentation. Read individual pages for lower data use. VM downloads can be large. Use a disposable lab, never a production server. Not a physical data-centre safety qualification.",
            "skills": ["Linux", "Networking", "Server hardware"],
            "source": "Canonical",
        },
        {
            "id": "azure-infrastructure",
            "title": "Describe Azure architecture and services",
            "provider": "Microsoft Learn",
            "url": "https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-azure-architecture-services/",
            "format": "Text learning modules",
            "device": "phone or laptop",
            "cost": "Free learning content; cloud deployments and certification exams may incur charges",
            "review": "Official beginner infrastructure learning path covering compute, networking and storage. Basic IT familiarity recommended. Cloud fundamentals complement, but do not replace, supervised physical data-centre training.",
            "skills": ["Cloud infrastructure", "Networking"],
            "source": "Microsoft Learn",
        },
    ]
)
