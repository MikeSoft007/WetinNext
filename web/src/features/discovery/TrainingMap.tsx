import { MapPin, ArrowUpRight } from "lucide-react";
/** Regional context only; campus links open explicit institution searches. */
export default function TrainingMap({
  location,
  places,
  market,
}: {
  location: string;
  market?: string;
  places: { name: string; location: string }[];
}) {
  const label =
    market === "Global"
      ? "Global"
      : market === "Nigeria"
        ? "Nigeria"
        : location;
  const regions: [RegExp, number[]][] = [
    [/kigali/i, [29.95, -2.03, 30.18, -1.84]],
    [/lagos/i, [3.15, 6.35, 3.65, 6.75]],
    [/abuja/i, [7.2, 8.9, 7.65, 9.25]],
    [/rwanda/i, [28.85, -2.85, 30.9, -1.0]],
    [/nigeria/i, [2.5, 4.0, 14.7, 14.0]],
  ];
  const bbox = regions.find(([pattern]) => pattern.test(label))?.[1] || [
    -180, -70, 180, 75,
  ];
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik`;
  const larger = `https://www.openstreetmap.org/#map=${market === "Global" ? 2 : market === "Nigeria" ? 5 : 11}/${(bbox[1] + bbox[3]) / 2}/${(bbox[0] + bbox[2]) / 2}`;
  return (
    <section className="training-map" aria-label="Training location map">
      <div className="training-map-heading">
        <div>
          <span className="eyebrow">YOUR NEXT STEP, ON THE MAP</span>
          <h3>Explore {label}</h3>
        </div>
        <a href={larger} target="_blank" rel="noreferrer">
          Open map
          <ArrowUpRight size={14} />
        </a>
      </div>
      <iframe
        key={embed}
        src={embed}
        title={`Regional map: ${label}`}
        referrerPolicy="no-referrer"
      />
      <p>
        Regional view · Confirm each campus with its institution.{" "}
        <span>© OpenStreetMap contributors</span>
      </p>
      <div className="map-choices">
        {places.map((place) => (
          <a
            key={place.name + place.location}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.location)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={13} />
            {place.name}
            <ArrowUpRight size={12} />
          </a>
        ))}
      </div>
    </section>
  );
}
