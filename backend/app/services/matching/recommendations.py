"""Explainable discovery using declared goals and unverified CV text signals."""

from datetime import date
import re
from app.core.skills import TRACKS, track_for, skills_in
from app.core.learning import enrich_resource

SUPPORTING_SKILLS = {"Research", "Communication", "Digital literacy", "Git", "Testing"}


def goal_relevance(profile, item):
    """Domain signals outrank generic transferable skills in job shortlists."""
    track = track_for(profile)
    target = set(TRACKS[track]["skills"])
    primary = target - SUPPORTING_SKILLS
    text = " ".join([item.get("title", ""), " ".join(item.get("skills", []))])
    domain = set(skills_in(text)) & primary
    keywords = sum(word in text.casefold() for word in TRACKS[track]["keywords"])
    return len(domain) * 5 + keywords * 3


def recommend(learner, reviews, resources, opportunities, market=None, shortlist=False):
    profile = learner.get("profile") or {}
    track = track_for(profile)
    stated_goal = " ".join(profile.get("goal", "").split())
    goal = stated_goal.casefold()
    explicit = profile.get("career_track", "auto") in TRACKS
    known = explicit or any(
        word in goal
        for spec in TRACKS.values()
        for word in spec["keywords"]
        if word != "analyst"
    )
    intent = profile.get("_goal_intent") or {}
    target_order = intent.get("skills") or (
        TRACKS[track]["skills"] if known else skills_in(goal)
    )
    known = known or bool(intent)
    target = set(target_order)
    primary_target = target - SUPPORTING_SKILLS
    goal_words = set(re.findall(r"[a-z]{4,}", goal)) - {
        "want",
        "become",
        "learn",
        "learning",
        "prepare",
        "career",
        "with",
        "from",
        "work",
        "skills",
        "internship",
        "jobs",
        "looking",
        "find",
        "developer",
        "engineer",
        "analyst",
        "manager",
        "specialist",
        "assistant",
    }
    track_name = TRACKS[track]["name"] if known else "Your stated goal"
    goal_label = stated_goal[:80] + ("…" if len(stated_goal) > 80 else "")

    mentioned = set(skills_in(profile.get("background", "")))
    if reviews:
        mentioned.update(skills_in(" ".join(reviews[0].get("skills", []))))
    practiced = set()
    completed = {
        int(week)
        for week, progress in learner.get("progress", {}).items()
        if progress.get("status") == "done"
    }
    resource_map = {resource["id"]: resource for resource in resources}
    for week in (learner.get("plan") or {}).get("weeks", []):
        if week["week"] in completed:
            resource = resource_map.get(week["resource_id"], {})
            practiced.update(
                resource.get("skills") or skills_in(resource.get("title", ""))
            )
            if week["resource_id"].startswith("gcf-"):
                practiced.add("Spreadsheets")
    gaps = target - mentioned
    priority_gaps = [skill for skill in target_order if skill in gaps]
    plan_resources = {r["id"] for r in (learner.get("plan") or {}).get("resources", [])}
    ranked_resources = []
    for resource in resources:
        resource = enrich_resource(resource)
        tags = set(resource.get("skills") or skills_in(resource["title"]))
        if resource["id"].startswith("gcf-"):
            tags.update(["Spreadsheets", "Data analysis"])
        relevant = tags if resource["id"] in plan_resources else tags & target
        lexical = len(
            goal_words
            & set(
                re.findall(
                    r"[a-z]{4,}", (resource["title"] + " " + " ".join(tags)).casefold()
                )
            )
        )
        if not relevant and not lexical:
            continue
        if (
            resource["id"] not in plan_resources
            and primary_target
            and not (tags & primary_target)
            and not lexical
        ):
            continue
        if resource.get("cost") and not resource["cost"].casefold().startswith("free"):
            continue
        device = resource.get("device", "").casefold()
        compatible = (
            profile.get("device") != "phone" or "phone" in device or device == "both"
        )
        relevant_ordered = (
            sorted(relevant)
            if resource["id"] in plan_resources
            else [skill for skill in target_order if skill in relevant]
        )
        missing_ordered = [skill for skill in relevant_ordered if skill in gaps]
        reasons = [
            (
                f"For your goal, “{goal_label}”, practise "
                + ", ".join(missing_ordered or relevant_ordered)
                + "."
                if relevant_ordered
                else f"Related to your goal, “{goal_label}”; review suitability."
            )
        ]
        if not compatible:
            reasons.append(
                "Practical exercises need computer access; plan this before starting."
            )
        if profile.get("low_data") and "video" in resource.get("format", "").lower():
            reasons.append("Video may exceed your data preference.")
        if profile.get("low_data") and resource["low_data_suitable"]:
            reasons.append(
                "Text-first format suits your lower-data preference; actual usage varies."
            )
        mentioned_relevant = [skill for skill in relevant_ordered if skill in mentioned]
        if mentioned_relevant:
            reasons.append(
                "Your background or CV mentions "
                + ", ".join(mentioned_relevant)
                + "; this is a signal, not verified proficiency."
            )
        ranked_resources.append(
            {
                "resource": resource,
                "reasons": reasons,
                "_score": len(relevant - SUPPORTING_SKILLS) * 8
                + len(relevant & gaps) * 3
                + len(relevant)
                + int(compatible) * 4
                + lexical
                + (
                    8
                    if profile.get("low_data") and resource["low_data_suitable"]
                    else 0
                )
                - (
                    3
                    if profile.get("low_data")
                    and "video" in resource.get("format", "").lower()
                    else 0
                ),
            }
        )
    ranked_jobs = []
    for opportunity in opportunities:
        if opportunity.get("availability") == "closed":
            continue
        if (
            opportunity["country"] != market
            if market
            else opportunity["country"] not in [profile.get("country"), "Global"]
        ):
            continue
        if (
            opportunity.get("deadline")
            and opportunity["deadline"] < date.today().isoformat()
        ):
            continue
        requirement_text = " ".join(opportunity.get("skills", []))
        required = set(skills_in(requirement_text)) | {
            skill
            for skill in target
            if re.search(
                r"(?<!\w)" + re.escape(skill) + r"(?!\w)", requirement_text, re.I
            )
        }
        relevant = required & target
        lexical = len(
            goal_words
            & set(re.findall(r"[a-z]{4,}", opportunity.get("title", "").casefold()))
        )
        if not relevant and not lexical:
            continue
        if primary_target and not (required & primary_target) and not lexical:
            continue
        title_track = track_for({"goal": opportunity.get("title", "")})
        if (
            known
            and not intent
            and title_track != "foundation"
            and title_track != track
        ):
            continue
        supported = sorted(required & mentioned)
        missing = sorted(required - mentioned)
        relevant_ordered = [skill for skill in target_order if skill in relevant]
        reasons = [
            f"Matches your goal, “{goal_label}”, through "
            + (", ".join(relevant_ordered) if relevant_ordered else track_name)
            + "."
        ]
        if market and market != "Global" and market != profile.get("country"):
            reasons.append(
                "This listing is in "
                + market
                + "; confirm residency, relocation and work eligibility before applying."
            )
        if opportunity["country"] == "Global":
            reasons.append(
                "Worldwide listing: confirm employer eligibility for your country."
            )
        if supported:
            reasons.append(
                "Your background or CV mentions "
                + ", ".join(supported)
                + "; these are signals, not verified proficiency."
            )
        if missing:
            reasons.append(
                "Not yet mentioned in your profile or CV: " + ", ".join(missing) + "."
            )
        if opportunity.get("seniority") and opportunity["seniority"].lower() not in [
            "entry",
            "junior",
            "internship",
        ]:
            reasons.append("Review seniority carefully: " + opportunity["seniority"])
        if required & practiced:
            reasons.append(
                "Related practice recorded: "
                + ", ".join(sorted(required & practiced))
                + ". Self-reported, not verified proficiency."
            )
        missing_resources = sorted(
            ranked_resources,
            key=lambda r: len(set(r["resource"].get("skills", [])) & set(missing)),
            reverse=True,
        )
        gap_resource = next(
            (
                r["resource"]
                for r in missing_resources
                if set(r["resource"].get("skills", [])) & set(missing)
            ),
            None,
        )
        focus = next(
            (skill for skill in target_order if skill in required - mentioned),
            next(
                (skill for skill in target_order if skill in required),
                "a relevant project",
            ),
        )
        senior = bool(
            re.search(
                r"\b(senior|lead|head|director|principal|staff)\b",
                opportunity.get("title", "")
                + " "
                + (opportunity.get("seniority") or ""),
                re.I,
            )
        )
        ranked_jobs.append(
            {
                "opportunity": opportunity,
                "reasons": reasons,
                "mentioned_skills": supported,
                "evidence_to_clarify": missing,
                "learning_resource": gap_resource,
                "next_action": f"Work through one {focus} example and save a short explanation of your contribution.",
                "minutes": min(profile.get("hours", 1) * 60, 45),
                "_score": len(relevant) * 2
                + len(supported)
                + len(required & practiced)
                + lexical * 3
                - (12 if senior else 0)
                - (3 if opportunity.get("sample") else 0),
            }
        )

    def top(rows):
        rows.sort(key=lambda row: row["_score"], reverse=True)
        return [
            {k: v for k, v in row.items() if k != "_score"}
            for row in rows[: (20 if shortlist else 4)]
        ]

    return {
        "track": track if known else "custom",
        "track_name": track_name,
        "priority_skills": priority_gaps,
        "resources": top(ranked_resources)[: (12 if shortlist else 2)],
        "opportunities": top(ranked_jobs),
        "notice": "Goal and CV text signals guide discovery; they do not verify proficiency, eligibility, or hiring readiness. Four weeks is a first project sprint.",
    }
