"""Transparent resource metadata: format hints are not measured bandwidth claims."""

from app.core.skills import skills_in

TEXT_IDS = {
    "gcf-sheets",
    "gcf-excel",
    "mdn-web",
    "python-tutorial",
    "sqlbolt",
    "openlearn-digital",
    "openlearn-project",
    "openstax-marketing",
}
EXERCISES = {
    "Python": "Write a function using fictional inputs. Check three cases and explain the output.",
    "JavaScript": "Build one small interaction and test it with a keyboard and on a narrow screen.",
    "HTML": "Create a page with headings, useful links and a clear document structure.",
    "SQL": "Write a SELECT query against sample records and explain which rows it returns.",
    "Spreadsheets": "Create a ten-row example tracker, add a formula and check its result manually.",
    "Marketing": "Draft a brief for a fictional local business: audience, message and one measure of success.",
    "Project management": "Create a small project task list with owners, dependencies and a realistic schedule.",
    "Cybersecurity": "Explain three warning signs in a fictional phishing message; do not test live systems.",
    "Customer support": "Draft a respectful response to a fictional customer problem and explain when to escalate.",
    "Research": "Compare two credible sources, record their links and write one unanswered question.",
}


def enrich_resource(resource):
    resource = dict(resource)
    format = resource.get("format", "").casefold()
    text = resource.get("id") in TEXT_IDS or any(
        word in format for word in ["text", "notes"]
    )
    video = "video" in format
    usage = (
        "mixed"
        if text and video
        else "video_heavy"
        if video
        else "text_first"
        if text
        else "unknown"
    )
    suitable = usage == "text_first"
    skills = resource.get("skills") or skills_in(resource.get("title", ""))
    if resource.get("id", "").startswith("gcf-"):
        skills = ["Spreadsheets", "Data analysis"]
    exercise = next(
        (EXERCISES[s] for s in skills if s in EXERCISES),
        "Complete one introductory activity, save your work and explain one thing you learned.",
    )
    return {
        **resource,
        "skills": skills,
        "data_usage": usage,
        "low_data_suitable": suitable,
        "data_note": "Prefer individual web lessons over full downloads. Images and external tools still use data; usage is not measured."
        if suitable
        else "Includes video. Use text notes where offered and save video for suitable connectivity."
        if video
        else "Data use is unverified. Check the provider before opening media or large downloads.",
        "learning_outcomes": [
            f"Practise an introductory {skill.lower()} activity and explain your own work."
            for skill in skills[:3]
        ]
        or ["Complete one introductory activity and explain your work."],
        "sample_exercise": exercise,
        "suggested_session_minutes": 20,
        "prerequisites": "Some programming familiarity is helpful; use a beginner introduction if unfamiliar."
        if resource.get("id") == "python-tutorial"
        else "Check the provider’s prerequisites and required accounts/tools before starting.",
    }


def prefer_low_data(resources, profile):
    if not profile.get("low_data"):
        return resources
    text = [r for r in resources if enrich_resource(r)["low_data_suitable"]]
    return text or resources
