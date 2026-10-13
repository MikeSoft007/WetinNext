"""Explain available evidence; never infer mastery from a completed check-in."""


def assess(opportunity, learner):
    profile, progress = learner["profile"], learner["progress"]
    completed = [int(k) for k, value in progress.items() if value["status"] == "done"]
    spreadsheet_progress = completed and any(
        w.get("resource_id") in ["gcf-excel", "gcf-sheets"]
        and w.get("week") in completed
        for w in (learner.get("plan") or {}).get("weeks", [])
    )
    supported = []
    if spreadsheet_progress and "Spreadsheets" in opportunity["skills"]:
        supported.append(
            {
                "requirement": "Spreadsheet practice",
                "evidence": f"{len(completed)} weekly tasks marked complete; learner-reported, not independently reviewed.",
            }
        )
    if opportunity["id"] == "sample-data" and profile.get("learner_type") in [
        "student",
        "both",
    ]:
        supported.append(
            {
                "requirement": "Current university student",
                "evidence": "Self-reported in your profile; confirm the provider’s exact enrolment conditions.",
            }
        )
    gaps = [
        {
            "requirement": skill,
            "reason": "No reviewed evidence has been recorded for this requirement.",
        }
        for skill in opportunity["skills"]
        if skill != "Spreadsheets" or not spreadsheet_progress
    ]
    missing = (
        opportunity["id"] == "sample-data"
        and profile.get("learner_type") == "self-taught"
    )
    label = "Eligibility requirement missing" if missing else "More information needed"
    return {
        "label": label,
        "sample": opportunity["sample"],
        "supported": supported,
        "gaps": gaps,
        "strength": f"{len(completed)} of 4 weekly tasks marked complete. Completion is self-reported and does not establish mastery.",
        "gap": (
            "Current university enrolment is required for this example."
            if missing
            else "Confirm eligibility and provide evidence for the remaining skills."
        ),
        "actions": [
            "Finish a relevant project and document one finding.",
            "Add an honest project description to your CV.",
            "Confirm eligibility and the closing time on the original listing.",
        ],
        "deadline": opportunity.get("deadline"),
        "deadline_notice": (
            "No real deadline: this is a practice listing."
            if opportunity["sample"]
            else (
                f"Listed closing date: {opportunity.get('deadline')}. Confirm the time and current availability on the source."
                if opportunity.get("deadline")
                else "No closing date provided. Check the original source for current availability."
            )
        ),
        "honest_guide": [
            "Describe what you built and which tools you used.",
            "Label skills you are still learning. Do not claim professional experience from a practice task.",
            "Explain that your project is personal or academic work; link evidence when available.",
        ],
        "notice": (
            "Synthetic practice listing. No employer application or hiring prediction."
            if opportunity["sample"]
            else "Preparation guidance only. Verify eligibility with the provider; no hiring prediction."
        ),
    }
