/** Original, lightweight vector artwork. Each moving part respects reduced motion. */
export default function LearnerIllustration({
  variant = "desk",
}: {
  variant?: "desk" | "books";
}) {
  return (
    <div
      className={`learner-illustration illustration-${variant}`}
      role="img"
      aria-label="Illustration of a learner building skills at a desk, with books and a growing plant"
    >
      <svg viewBox="0 0 640 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g
          stroke="#253E40"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M88 420C17 318 78 154 230 121S532 146 563 292C586 402 473 481 309 469"
            fill="#F5F8F7"
            stroke="none"
          />
          <path
            className="art-route"
            d="M95 228C39 166 146 56 244 92S348 165 429 88S621 125 559 231"
            stroke="#B9CECB"
            strokeDasharray="3 10"
          />
          <g className="art-orbit">
            <path d="m507 82 70-22-25 53-15-22-30-9Z" fill="#EFCDBF" />
            <path d="m537 91 40-31" />
            <path d="m537 91-5 19 12-9" />
          </g>
          <g className="art-card">
            <rect x="82" y="92" width="137" height="69" rx="13" fill="white" />
            <circle cx="107" cy="117" r="11" fill="#DDEBE6" stroke="none" />
            <path d="m102 117 4 4 7-8" stroke="#38776D" />
            <path d="M129 113h65m-65 10h45" stroke="#B0C1BD" />
            <path d="M97 143h101" stroke="#DDE6E2" />
          </g>
          <g className="art-star" stroke="#38776D">
            <path d="M446 126v22m-11-11h22M471 171v12m-6-6h12" />
          </g>
          {/* Chair and desk */}
          <path
            d="M380 254c51-18 97 7 94 60l-5 56c-2 23-18 36-40 36h-74"
            fill="#F0D6C9"
          />
          <path d="m454 395 23 101m-94-98-13 98" />
          <path d="M362 262c54-18 95 14 92 63" stroke="#C5A89B" />
          <path d="M176 327h342v13H176z" fill="white" />
          <path d="m203 340-13 156m287-156 12 156" />
          <path d="M221 345v151m245-151v151" stroke="#B4C3BE" />
          {/* Learner's legs and shoes */}
          <path d="m343 354-51 65 31 60 21-9-13-49 73-39-3-28" fill="#253E40" />
          <path d="m379 367-19 68-49 44 16 16 70-47 36-74" fill="#253E40" />
          <path
            d="m314 470 14 11-17 22h-43c-5-12 13-12 25-18l21-15Z"
            fill="white"
          />
          <path d="m329 472 16-5 15 22c6 9 2 14-9 14h-26l4-31Z" fill="white" />
          <path d="M274 499h35m21 0h23" />
          {/* Torso */}
          <path
            d="M337 213c-21 3-39 19-46 46l-14 49 48 13 11-38-3 81c28 14 69 17 98 2l-11-109c-2-26-17-43-42-46"
            fill="#77A69D"
          />
          <path d="m347 222 11 15 16-18m-16 18 5 72m-32-62-10 41" />
          <path d="m413 255 18 49-49 15-9-13 31-14-10-29" fill="#77A69D" />
          {/* Head, curls and neck */}
          <path d="m349 194-2 24c8 15 21 17 31-1l-5-26" fill="#B97E5E" />
          <path
            d="M337 153c2-22 35-34 54-16 11 11 8 24 4 35l-5 23c-3 17-23 23-36 13-9-7-13-18-13-28"
            fill="#C98C67"
          />
          <path
            d="M340 176c-13-4-15-16-7-23-11-8-7-21 4-24-1-13 13-20 23-15 10-10 25-5 29 4 15-3 25 8 20 20 8 13-1 25-13 26l-3-19c-13 4-25 1-33-9-2 14-9 21-20 22v18Z"
            fill="#253E40"
          />
          <path d="M343 173c-9-9-17 2-10 10l10 4" fill="#C98C67" />
          <path d="m380 166 3 10-7 1m-13 13c7 5 13 4 18 0" />
          <path d="M362 165h2m22-3h2" strokeWidth="3.5" />
          {/* Arm and laptop */}
          <path
            d="m294 267-16 32 50 9-1 16-70-8c-11-2-16-10-11-21l26-48"
            fill="#77A69D"
          />
          <path d="m320 308 20-5c9 0 14 3 19 10l-9 10-25 1" fill="#C98C67" />
          <path d="m382 306-21 3c-7 2-11 7-10 14h25l9-7" fill="#C98C67" />
          <path d="m221 264 98 0 24 63H242l-21-63Z" fill="#F0D6C9" />
          <path d="M240 327h129v5H240z" fill="white" />
          <ellipse
            cx="281"
            cy="294"
            rx="7"
            ry="9"
            transform="rotate(-20 281 294)"
            fill="#fff"
            stroke="none"
          />
          {/* Plant */}
          <g className="art-plant">
            <path
              d="M105 440v-82m0 51c-34-13-43-35-38-55 22 8 37 22 38 55m0-15c32-17 39-38 32-54-20 9-29 28-32 54m0-23c-17-17-20-37-11-56 17 13 21 31 11 56"
              fill="#D4E4DC"
            />
            <path d="M75 438h61l-9 57H84l-9-57Z" fill="#EFCDBF" />
            <path d="M82 448h47" stroke="#B99D91" />
          </g>
          {/* Books */}
          <g className="art-books">
            <rect
              x="498"
              y="455"
              width="88"
              height="16"
              rx="3"
              fill="#D4E4DC"
            />
            <rect x="507" y="439" width="72" height="16" rx="3" fill="white" />
            <path d="M501 471h89v23h-89z" fill="#EFCDBF" />
            <path d="M514 445h54m-48 33v10m8-10v10" />
          </g>
          <path d="M61 503h546" stroke="#B0C1BD" />
          <g className="art-check">
            <circle cx="511" cy="237" r="29" fill="#fff" />
            <circle cx="511" cy="237" r="22" fill="#DDEBE6" stroke="none" />
            <path d="m500 237 8 8 15-17" stroke="#38776D" strokeWidth="3" />
          </g>
        </g>
      </svg>
    </div>
  );
}
