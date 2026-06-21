import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import {
  ChevronsUp,
  ChevronsDown,
  CircleHelp,
  ClipboardList,
  Dices,
  RotateCcw,
  Search,
  ShieldPlus,
  Share2,
  Trophy,
  UsersRound,
} from "lucide-react";
import {
  allDraftSquads,
  clubWikiPages,
  columns,
  defaultGroupPicks,
  formationOptions,
  formationSlots,
  nationAssets,
  players,
  worldCupGroups,
} from "./data/gameData";
import "./styles.css";

const MAX_GUESSES = 6;

const photoCache = new Map();
const clubLogoCache = new Map();

function initials(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function clubInitials(club) {
  return club
    .replace("Paris Saint-Germain", "PSG")
    .replace("Manchester", "Man")
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function PlayerPhoto({ player, size = "small" }) {
  const [photo, setPhoto] = useState(() => photoCache.get(player.id) || "");

  useEffect(() => {
    if (photoCache.has(player.id)) {
      setPhoto(photoCache.get(player.id));
      return;
    }

    let active = true;

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(player.name)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        const thumbnail = data?.thumbnail?.source || "";
        photoCache.set(player.id, thumbnail);
        setPhoto(thumbnail);
      })
      .catch(() => {
        if (!active) return;
        photoCache.set(player.id, "");
        setPhoto("");
      });

    return () => {
      active = false;
    };
  }, [player]);

  return (
    <span className={`player-photo player-photo--${size}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : <span>{initials(player.name)}</span>}
    </span>
  );
}

function FlagIcon({ nation }) {
  const asset = nationAssets[nation];

  if (!asset) {
    return (
      <span className="flag flag--fallback" aria-hidden="true">
        {initials(nation)}
      </span>
    );
  }

  return (
    <img
      className="flag"
      src={`https://flagcdn.com/w40/${asset.code}.png`}
      srcSet={`https://flagcdn.com/w80/${asset.code}.png 2x`}
      alt=""
      aria-hidden="true"
      loading="lazy"
    />
  );
}

function ClubBadge({ club }) {
  const [logo, setLogo] = useState(() => clubLogoCache.get(club) || "");
  const page = clubWikiPages[club] || club.replaceAll(" ", "_");

  useEffect(() => {
    if (clubLogoCache.has(club)) {
      setLogo(clubLogoCache.get(club));
      return;
    }

    let active = true;

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        const thumbnail = data?.thumbnail?.source || "";
        clubLogoCache.set(club, thumbnail);
        setLogo(thumbnail);
      })
      .catch(() => {
        if (!active) return;
        clubLogoCache.set(club, "");
        setLogo("");
      });

    return () => {
      active = false;
    };
  }, [club, page]);

  return (
    <span className="club-badge" aria-hidden="true">
      {logo ? <img src={logo} alt="" loading="lazy" /> : clubInitials(club)}
    </span>
  );
}

function StatValue({ player, column }) {
  const value = player[column.key];

  if (column.key === "nation") {
    return (
      <span className="visual-value">
        <FlagIcon nation={player.nation} />
        <span>{value}</span>
      </span>
    );
  }

  if (column.key === "club" || column.key === "currentClub" || column.key === "formerClub") {
    return (
      <span className="visual-value">
        <ClubBadge club={value} />
        <span>{value}</span>
      </span>
    );
  }

  return <span>{formatValue(value, column.type)}</span>;
}

function TeamName({ team }) {
  return (
    <span className="team-name">
      <FlagIcon nation={team} />
      <span>{team}</span>
    </span>
  );
}

function getQualifiedTeams(groupPicks) {
  const thirds = worldCupGroups
    .filter((group) => groupPicks[group.id]?.thirdAdvances)
    .map((group) => ({ group: group.id, seed: "3rd", team: groupPicks[group.id].third }))
    .slice(0, 8);

  return [
    ...worldCupGroups.map((group) => ({
      group: group.id,
      seed: "1st",
      team: groupPicks[group.id].first,
    })),
    ...worldCupGroups.map((group) => ({
      group: group.id,
      seed: "2nd",
      team: groupPicks[group.id].second,
    })),
    ...thirds,
  ].filter((entry) => entry.team);
}

function buildRound(entries) {
  const matches = [];

  for (let index = 0; index < entries.length / 2; index += 1) {
    matches.push([entries[index], entries[entries.length - 1 - index]]);
  }

  return matches;
}

function MatchPicker({ match, selected, onPick, index = 0, isFinal = false }) {
  return (
    <div className="match-picker">
      {!isFinal && (
        <span
          className={`bracket-connector ${index % 2 === 0 ? "connector-top" : "connector-bottom"}`}
          aria-hidden="true"
        />
      )}
      {match.map((entry) => (
        <button
          className={selected === entry.team ? "selected" : ""}
          key={`${entry.group}-${entry.seed}-${entry.team}`}
          onClick={() => onPick(entry.team)}
        >
          <TeamName team={entry.team} />
          <small>
            {entry.seed} Group {entry.group}
          </small>
        </button>
      ))}
    </div>
  );
}

function drawRoundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawCardText(context, text, x, y, maxWidth) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += 30;
      return;
    }
    line = testLine;
  });

  context.fillText(line, x, currentY);
  return currentY;
}

function fitCanvasText(context, text, x, y, maxWidth, startSize, minSize = 40) {
  let fontSize = startSize;

  while (fontSize > minSize) {
    context.font = `900 ${fontSize}px Inter, Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    fontSize -= 2;
  }

  context.fillText(text, x, y);
  return fontSize;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function createPredictionImage({ champion, finalist, semifinalists, groupWinners }) {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = 1200 * scale;
  canvas.height = 1500 * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);

  const gradient = context.createLinearGradient(0, 0, 1200, 1500);
  gradient.addColorStop(0, "#103f2b");
  gradient.addColorStop(0.48, "#08120f");
  gradient.addColorStop(1, "#3d1616");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 1500);

  context.strokeStyle = "rgba(215,255,79,0.36)";
  context.lineWidth = 3;
  drawRoundRect(context, 54, 54, 1092, 1392, 26);
  context.stroke();

  context.fillStyle = "#d7ff4f";
  context.font = "900 34px Inter, Arial, sans-serif";
  context.fillText("WC PLAYER GUESS", 96, 132);

  context.fillStyle = "#ffffff";
  fitCanvasText(context, "World Cup Predictor", 96, 246, 1000, 82, 48);

  context.fillStyle = "#d7ff4f";
  context.font = "900 46px Inter, Arial, sans-serif";
  context.fillText("Champion", 96, 430);

  context.fillStyle = "#ffffff";
  fitCanvasText(context, champion, 96, 570, 980, 112, 52);

  context.fillStyle = "rgba(255,255,255,0.12)";
  drawRoundRect(context, 96, 690, 1008, 170, 18);
  context.fill();

  context.fillStyle = "#d7ff4f";
  context.font = "900 30px Inter, Arial, sans-serif";
  context.fillText("Final", 132, 760);

  context.fillStyle = "#ffffff";
  context.font = "800 42px Inter, Arial, sans-serif";
  drawCardText(context, `${champion} over ${finalist}`, 132, 822, 900);

  context.fillStyle = "rgba(255,255,255,0.12)";
  drawRoundRect(context, 96, 910, 1008, 170, 18);
  context.fill();

  context.fillStyle = "#d7ff4f";
  context.font = "900 30px Inter, Arial, sans-serif";
  context.fillText("Semifinalists", 132, 980);

  context.fillStyle = "#ffffff";
  context.font = "800 36px Inter, Arial, sans-serif";
  drawCardText(context, semifinalists || "Pick the semifinals", 132, 1040, 900);

  context.fillStyle = "rgba(255,255,255,0.12)";
  drawRoundRect(context, 96, 1130, 1008, 210, 18);
  context.fill();

  context.fillStyle = "#d7ff4f";
  context.font = "900 30px Inter, Arial, sans-serif";
  context.fillText("Group winners", 132, 1200);

  context.fillStyle = "#ffffff";
  context.font = "700 26px Inter, Arial, sans-serif";
  drawCardText(context, groupWinners, 132, 1260, 900);

  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "800 24px Inter, Arial, sans-serif";
  context.fillText("Made with WC Player Guess", 96, 1414);

  return canvas;
}

function predictionSummary({ champion, finalEntries, sfEntries, groupPicks }) {
  return {
    finalist: finalEntries.find((entry) => entry.team !== champion)?.team || "Finalist",
    semifinalists: sfEntries.map((entry) => entry.team).join(" · "),
    groupWinners: worldCupGroups
      .map((group) => `${group.id}: ${groupPicks[group.id].first}`)
      .join("   "),
  };
}

function PredictorPage() {
  const [groupPicks, setGroupPicks] = useState(defaultGroupPicks);
  const [bracketPicks, setBracketPicks] = useState({});
  const [shareImageUrl, setShareImageUrl] = useState("");
  const qualifiedTeams = getQualifiedTeams(groupPicks);
  const thirdCount = worldCupGroups.filter((group) => groupPicks[group.id].thirdAdvances).length;

  useEffect(() => {
    return () => {
      if (shareImageUrl) URL.revokeObjectURL(shareImageUrl);
    };
  }, [shareImageUrl]);

  function updateGroupPick(groupId, slot, team) {
    setBracketPicks({});
    setGroupPicks((current) => {
      const nextGroup = { ...current[groupId] };
      const duplicateSlot = ["first", "second", "third"].find(
        (key) => key !== slot && nextGroup[key] === team,
      );

      if (duplicateSlot) {
        nextGroup[duplicateSlot] = nextGroup[slot];
      }

      nextGroup[slot] = team;
      return { ...current, [groupId]: nextGroup };
    });
  }

  function toggleThird(groupId) {
    setBracketPicks({});
    setGroupPicks((current) => {
      const nextGroup = { ...current[groupId] };
      const nextValue = !nextGroup.thirdAdvances;
      const activeThirds = worldCupGroups.filter((group) => current[group.id].thirdAdvances).length;

      if (nextValue && activeThirds >= 8) return current;

      nextGroup.thirdAdvances = nextValue;
      return { ...current, [groupId]: nextGroup };
    });
  }

  function pickWinner(round, index, team) {
    setBracketPicks((current) => ({ ...current, [`${round}-${index}`]: team }));
  }

  function getWinners(round, matches) {
    return matches
      .map((match, index) => {
        const team = bracketPicks[`${round}-${index}`];
        return match.find((entry) => entry.team === team);
      })
      .filter(Boolean);
  }

  const r32Matches = buildRound(qualifiedTeams);
  const r16Entries = getWinners("r32", r32Matches);
  const r16Matches = r16Entries.length === 16 ? buildRound(r16Entries) : [];
  const qfEntries = getWinners("r16", r16Matches);
  const qfMatches = qfEntries.length === 8 ? buildRound(qfEntries) : [];
  const sfEntries = getWinners("qf", qfMatches);
  const sfMatches = sfEntries.length === 4 ? buildRound(sfEntries) : [];
  const finalEntries = getWinners("sf", sfMatches);
  const finalMatch = finalEntries.length === 2 ? [finalEntries] : [];
  const champion = finalMatch.length ? bracketPicks["final-0"] : "";

  useEffect(() => {
    if (!champion) {
      setShareImageUrl("");
      return;
    }

    const summary = predictionSummary({ champion, finalEntries, sfEntries, groupPicks });
    const canvas = createPredictionImage({ champion, ...summary });
    const nextUrl = canvas.toDataURL("image/png");
    setShareImageUrl(nextUrl);
  }, [champion, finalEntries, groupPicks, sfEntries]);

  function resetPredictor() {
    setGroupPicks(defaultGroupPicks);
    setBracketPicks({});
    setShareImageUrl("");
  }

  async function sharePredictionImage() {
    if (!champion) return;

    const summary = predictionSummary({ champion, finalEntries, sfEntries, groupPicks });
    const canvas = createPredictionImage({ champion, ...summary });
    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    if (!blob) {
      setShareImageUrl(dataUrl);
      downloadDataUrl(dataUrl, "world-cup-prediction.png");
      return;
    }

    const file = new File([blob], "world-cup-prediction.png", { type: "image/png" });
    const objectUrl = URL.createObjectURL(blob);
    setShareImageUrl((current) => {
      if (current && current.startsWith("blob:")) URL.revokeObjectURL(current);
      return objectUrl;
    });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          title: "My World Cup Prediction",
          text: `My World Cup champion pick is ${champion}.`,
          files: [file],
        });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }

    downloadDataUrl(dataUrl, "world-cup-prediction.png");
  }

  return (
    <section className="predictor-page" aria-label="World Cup predictor">
      <div className="tool-page__header">
        <ClipboardList size={34} />
        <div>
          <h1>World Cup Predictor</h1>
          <p>Rank each group, choose the eight third-place teams, then pick every knockout winner.</p>
        </div>
      </div>

      <div className="predictor-actions">
        <div>
          <strong>{qualifiedTeams.length}/32</strong>
          <span>qualified teams selected</span>
        </div>
        <div>
          <strong>{thirdCount}/8</strong>
          <span>third-place teams</span>
        </div>
        <button onClick={resetPredictor}>
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      <div className="groups-grid">
        {worldCupGroups.map((group) => {
          const picks = groupPicks[group.id];

          return (
            <div className="group-card" key={group.id}>
              <div className="group-card__top">
                <strong>Group {group.id}</strong>
                <button
                  className={picks.thirdAdvances ? "third-toggle active" : "third-toggle"}
                  onClick={() => toggleThird(group.id)}
                  disabled={!picks.thirdAdvances && thirdCount >= 8}
                >
                  3rd advances
                </button>
              </div>

              {[
                ["first", "1st"],
                ["second", "2nd"],
                ["third", "3rd"],
              ].map(([slot, label]) => (
                <label className="rank-select" key={slot}>
                  <span>{label}</span>
                  <select
                    value={picks[slot]}
                    onChange={(event) => updateGroupPick(group.id, slot, event.target.value)}
                  >
                    {group.teams.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          );
        })}
      </div>

      <div className="bracket-shell">
        <div className="bracket-top">
          <div>
            <h2>Knockout Bracket</h2>
            <p>This uses a clean custom seed order for gameplay. FIFA's real third-place mapping is more complex.</p>
          </div>
          {champion && (
            <div className="champion-badge">
              <Trophy size={18} />
              <TeamName team={champion} />
            </div>
          )}
        </div>

        <div className="bracket-columns">
          {[
            ["Round of 32", "r32", r32Matches],
            ["Round of 16", "r16", r16Matches],
            ["Quarterfinals", "qf", qfMatches],
            ["Semifinals", "sf", sfMatches],
            ["Final", "final", finalMatch],
          ].map(([label, round, matches]) => (
            <div className={`bracket-round bracket-round--${round}`} key={round}>
              <h3>{label}</h3>
              {matches.length === 0 ? (
                <div className="round-empty">Complete the previous round</div>
              ) : (
                matches.map((match, index) => (
                  <MatchPicker
                    key={`${round}-${index}`}
                    match={match}
                    index={index}
                    isFinal={round === "final"}
                    selected={bracketPicks[`${round}-${index}`]}
                    onPick={(team) => pickWinner(round, index, team)}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {champion && (
        <div className="prediction-share">
          <Share2 size={20} />
          <span>
            My World Cup champion pick is <strong>{champion}</strong>.
          </span>
          <button onClick={sharePredictionImage}>Share image</button>
          {shareImageUrl && (
            <a href={shareImageUrl} download="world-cup-prediction.png">
              Download PNG
            </a>
          )}
        </div>
      )}

      {shareImageUrl && (
        <div className="share-preview" aria-label="Share image preview">
          <img src={shareImageUrl} alt="Generated World Cup prediction card" />
          <p>Use the downloaded PNG for Instagram, Facebook, stories, or posts.</p>
        </div>
      )}
    </section>
  );
}

function randomSquad(excludeId) {
  const pool = allDraftSquads.filter((squad) => squad.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

function canFitPlayer(slot, player) {
  return slot.accepts.includes(player.position);
}

function teamMetrics(slots, team) {
  const picked = slots.map((slot) => ({ slot, player: team[slot.id] })).filter((entry) => entry.player);
  const average = picked.length
    ? Math.round(picked.reduce((total, entry) => total + entry.player.rating, 0) / picked.length)
    : 0;
  const byRole = (labels) => {
    const matches = picked.filter((entry) => labels.includes(entry.slot.label));
    if (!matches.length) return 0;
    return Math.round(matches.reduce((total, entry) => total + entry.player.rating, 0) / matches.length);
  };
  const nations = new Set(picked.map((entry) => entry.player.nation));
  const years = new Set(picked.map((entry) => entry.player.squad));
  const chemistry = Math.max(55, Math.min(99, 104 - nations.size * 4 + Math.max(0, 5 - years.size)));
  const winChance = Math.max(
    4,
    Math.min(78, Math.round((average - 70) * 2.4 + (chemistry - 70) * 0.32)),
  );

  return {
    attack: byRole(["LW", "ST", "RW", "CF", "LM", "RM"]),
    midfield: byRole(["CDM", "CM", "CAM"]),
    defense: byRole(["LB", "CB", "RB"]),
    goalkeeper: byRole(["GK"]),
    average,
    chemistry,
    nations: nations.size,
    eras: years.size,
    winChance,
  };
}

function TeamMakerPage() {
  const [formationId, setFormationId] = useState("4-3-3");
  const selectedFormation =
    formationOptions.find((formation) => formation.id === formationId) || formationOptions[0];
  const activeSlots = selectedFormation.slots;
  const [currentSquad, setCurrentSquad] = useState(() => randomSquad());
  const [team, setTeam] = useState(() => Object.fromEntries(activeSlots.map((slot) => [slot.id, null])));
  const [rerolls, setRerolls] = useState(2);
  const [draftedCount, setDraftedCount] = useState(0);
  const [draftMessage, setDraftMessage] = useState("Roll a squad, pick one player, build your XI.");

  const filledSlots = activeSlots.filter((slot) => team[slot.id]).length;
  const ratingTotal = activeSlots.reduce((total, slot) => total + (team[slot.id]?.rating || 0), 0);
  const averageRating = filledSlots ? Math.round(ratingTotal / filledSlots) : 0;
  const complete = filledSlots === activeSlots.length;
  const metrics = teamMetrics(activeSlots, team);

  function changeFormation(nextFormationId) {
    const nextFormation =
      formationOptions.find((formation) => formation.id === nextFormationId) || formationOptions[0];
    setFormationId(nextFormationId);
    setTeam((current) => {
      const pickedPlayers = Object.values(current).filter(Boolean);
      const nextTeam = Object.fromEntries(nextFormation.slots.map((slot) => [slot.id, null]));

      pickedPlayers.forEach((player) => {
        const targetSlot = nextFormation.slots.find((slot) => !nextTeam[slot.id] && canFitPlayer(slot, player));
        if (targetSlot) nextTeam[targetSlot.id] = player;
      });

      return nextTeam;
    });
    setDraftMessage(`Switched to ${nextFormation.label}. Players were re-slotted where possible.`);
  }

  function pickPlayerFromRoll(player) {
    if (complete) return;

    const targetSlot = activeSlots.find((slot) => !team[slot.id] && canFitPlayer(slot, player));

    if (!targetSlot) {
      setDraftMessage(`${player.name} needs a ${player.position} slot, but none are open.`);
      return;
    }

    setTeam((current) => ({
      ...current,
      [targetSlot.id]: { ...player, squad: currentSquad.title, nation: currentSquad.nation },
    }));
    setDraftedCount((count) => count + 1);
    setDraftMessage(`${player.name} added at ${targetSlot.label}.`);

    if (filledSlots + 1 < activeSlots.length) {
      setCurrentSquad((squad) => randomSquad(squad.id));
    }
  }

  function rerollSquad() {
    if (rerolls <= 0 || complete) return;
    setCurrentSquad((squad) => randomSquad(squad.id));
    setRerolls((count) => count - 1);
    setDraftMessage("Rerolled. Choose carefully.");
  }

  function resetDraft() {
    setCurrentSquad(randomSquad());
    setTeam(Object.fromEntries(activeSlots.map((slot) => [slot.id, null])));
    setRerolls(2);
    setDraftedCount(0);
    setDraftMessage("New draft started.");
  }

  return (
    <section className="team-maker-page" aria-label="Team maker">
      <div className="tool-page__header">
        <ShieldPlus size={34} />
        <div>
          <h1>Team Maker</h1>
          <p>Roll a World Cup year and squad, choose one player per roll, and build your best XI.</p>
        </div>
      </div>

      <div className="formation-picker" aria-label="Formation picker">
        {formationOptions.map((formation) => (
          <button
            className={formationId === formation.id ? "active" : ""}
            key={formation.id}
            onClick={() => changeFormation(formation.id)}
          >
            {formation.label}
          </button>
        ))}
      </div>

      <div className="draft-hud">
        <div>
          <strong>{filledSlots}/11</strong>
          <span>players drafted</span>
        </div>
        <div>
          <strong>{averageRating || "--"}</strong>
          <span>average rating</span>
        </div>
        <div>
          <strong>{rerolls}</strong>
          <span>rerolls left</span>
        </div>
        <button onClick={resetDraft}>
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      <div className="team-maker-layout">
        <div className="squad-roll">
          <div className="squad-roll__top">
            <div>
              <span>Current roll</span>
              <h2>
                {currentSquad.year} {currentSquad.nation}
              </h2>
            </div>
            <button onClick={rerollSquad} disabled={rerolls <= 0 || complete}>
              <Dices size={17} />
              Reroll
            </button>
          </div>

          <div className="rolled-players">
            {currentSquad.players.map((player) => {
              const canPick = activeSlots.some((slot) => !team[slot.id] && canFitPlayer(slot, player));

              return (
                <button
                  className={canPick ? "" : "disabled"}
                  key={`${currentSquad.id}-${player.name}`}
                  onClick={() => pickPlayerFromRoll(player)}
                  disabled={!canPick || complete}
                >
                  <div>
                    <strong>{player.name}</strong>
                    <small>
                      {player.position} · {currentSquad.title}
                    </small>
                  </div>
                  <span>{player.rating}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="draft-side">
          <div className="draft-message">{complete ? "XI complete. That is a serious squad." : draftMessage}</div>

          <div className={`formation-preview formation-preview--draft formation-${formationId}`}>
            {activeSlots.map((slot) => {
              const player = team[slot.id];

              return (
                <button className={`${player ? "filled" : ""} slot-${slot.id}`} key={slot.id}>
                  <span>{slot.label}</span>
                  {player ? (
                    <>
                      <strong>{player.name}</strong>
                      <small>
                        {player.rating} · {player.squad}
                      </small>
                    </>
                  ) : (
                    <small>Open slot</small>
                  )}
                </button>
              );
            })}
          </div>

          <div className="draft-summary">
            <span>Draft picks used: {draftedCount}</span>
            <span>Rule: one player per roll</span>
            <span>Rerolls: 2 max</span>
          </div>

          {complete && (
            <div className="team-result-card" aria-label="Completed team rating">
              <div className="team-result-card__top">
                <div>
                  <span>Final XI</span>
                  <h2>{selectedFormation.label} Draft Complete</h2>
                </div>
                <strong>{metrics.average}</strong>
              </div>

              <div className="win-meter">
                <div>
                  <span>2026 WC win chance</span>
                  <strong>{metrics.winChance}%</strong>
                </div>
                <div className="meter-track">
                  <span style={{ width: `${metrics.winChance}%` }} />
                </div>
              </div>

              <div className="metric-grid">
                <div>
                  <span>Attack</span>
                  <strong>{metrics.attack}</strong>
                </div>
                <div>
                  <span>Midfield</span>
                  <strong>{metrics.midfield}</strong>
                </div>
                <div>
                  <span>Defense</span>
                  <strong>{metrics.defense}</strong>
                </div>
                <div>
                  <span>GK</span>
                  <strong>{metrics.goalkeeper}</strong>
                </div>
                <div>
                  <span>Chemistry</span>
                  <strong>{metrics.chemistry}</strong>
                </div>
                <div>
                  <span>Nations</span>
                  <strong>{metrics.nations}</strong>
                </div>
              </div>

              <p>
                {metrics.winChance >= 55
                  ? "Elite contender. This XI has enough quality to scare anyone."
                  : metrics.winChance >= 32
                    ? "Dangerous outsider. The ceiling is high, but the draw matters."
                    : "Fun squad, tough tournament. You may need a miracle run."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function pickPlayer(excludeId) {
  const pool = players.filter((player) => player.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

function compareCell(guess, answer, column) {
  const guessedValue = guess[column.key];
  const answerValue = answer[column.key];

  if (column.type === "number" || column.type === "money") {
    return {
      status: guessedValue === answerValue ? "correct" : "miss",
      direction:
        guessedValue === answerValue ? "same" : guessedValue < answerValue ? "higher" : "lower",
    };
  }

  if (column.type === "position") {
    return {
      status:
        guessedValue === answerValue ? "correct" : guess.role === answer.role ? "close" : "miss",
      direction: "same",
    };
  }

  if (column.type === "former") {
    const exact = guessedValue === answerValue;

    return { status: exact ? "correct" : "miss", direction: "same" };
  }

  return { status: guessedValue === answerValue ? "correct" : "miss", direction: "same" };
}

function formatValue(value, type) {
  if (type === "money") return `€${value}m`;
  return value;
}

function App() {
  const [activePage, setActivePage] = useState("guess");
  const [answer, setAnswer] = useState(() => pickPlayer());
  const [guesses, setGuesses] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Find the hidden World Cup player.");

  const won = guesses.some((guess) => guess.id === answer.id);
  const finished = won || guesses.length >= MAX_GUESSES;

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return players.slice(0, 6);
    return players
      .filter((player) => player.name.toLowerCase().includes(term))
      .filter((player) => !guesses.some((guess) => guess.id === player.id))
      .slice(0, 6);
  }, [guesses, query]);

  function submitGuess(player) {
    if (!player || finished || guesses.some((guess) => guess.id === player.id)) return;

    const nextGuesses = [player, ...guesses];
    setGuesses(nextGuesses);
    setQuery("");

    if (player.id === answer.id) {
      setMessage(`Correct. ${player.name} was the player.`);
      return;
    }

    if (nextGuesses.length >= MAX_GUESSES) {
      setMessage(`Out of guesses. It was ${answer.name}.`);
      return;
    }

    setMessage(`${MAX_GUESSES - nextGuesses.length} guesses left.`);
  }

  function submitFromInput(event) {
    event.preventDefault();
    const exact = players.find((player) => player.name.toLowerCase() === query.trim().toLowerCase());
    submitGuess(exact || suggestions[0]);
  }

  function resetGame() {
    setAnswer((current) => pickPlayer(current.id));
    setGuesses([]);
    setQuery("");
    setMessage("New player loaded.");
  }

  return (
    <main className="app">
      <nav className="top-nav" aria-label="Main navigation">
        <button
          className={activePage === "guess" ? "active" : ""}
          onClick={() => setActivePage("guess")}
        >
          <Trophy size={18} />
          <span>Guess</span>
        </button>
        <button
          className={activePage === "predictor" ? "active" : ""}
          onClick={() => setActivePage("predictor")}
        >
          <ClipboardList size={18} />
          <span>Predictor</span>
        </button>
        <button
          className={activePage === "team-maker" ? "active" : ""}
          onClick={() => setActivePage("team-maker")}
        >
          <UsersRound size={18} />
          <span>Team Maker</span>
        </button>
      </nav>

      {activePage === "guess" && (
        <>
          <section className="hero" aria-label="World Cup player guess game">
        <div className="hero__content">
          <div className="brand">
            <Trophy size={22} />
            <span>WC Player Guess</span>
          </div>

          <div className="score-panel">
            <span>{guesses.length}/{MAX_GUESSES}</span>
            <button className="icon-button" onClick={resetGame} aria-label="Load new player">
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="title-block">
            <h1>Guess the World Cup player</h1>
            <p>
              Every guess unlocks stat clues across nation, exact position, club history, trophies,
              and market value.
            </p>
          </div>

          <div className="legend" aria-label="Color legend">
            <div>
              <span className="legend-dot legend-dot--green" />
              <strong>Green</strong>
              <small>Exact match</small>
            </div>
            <div>
              <span className="legend-dot legend-dot--yellow" />
              <strong>Yellow</strong>
              <small>Position role match only</small>
            </div>
            <div>
              <span className="legend-dot legend-dot--red" />
              <strong>Red</strong>
              <small>Wrong value</small>
            </div>
            <div>
              <span className="legend-arrow">↑↓</span>
              <strong>Arrows</strong>
              <small>Answer is more or less</small>
            </div>
          </div>

          <form className="guess-form" onSubmit={submitFromInput}>
            <Search className="search-icon" size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a player"
              disabled={finished}
              aria-label="Search a player"
            />
            <button type="submit" disabled={finished || suggestions.length === 0}>
              Guess
            </button>
          </form>

          {!finished && (
            <div className="suggestions" aria-label="Player suggestions">
              {suggestions.map((player) => (
                <button key={player.id} onClick={() => submitGuess(player)}>
                  <PlayerPhoto player={player} />
                  <span className="suggestion-copy">
                    <strong>{player.name}</strong>
                    <small>
                      <FlagIcon nation={player.nation} />
                      {player.nation} · {player.position}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className={`status ${won ? "status--win" : finished ? "status--loss" : ""}`}>
            <CircleHelp size={18} />
            <span>{message}</span>
          </div>

          {finished && (
            <div className="reveal-card" aria-label="Hidden player reveal">
              <PlayerPhoto player={answer} size="large" />
              <div className="reveal-copy">
                <span>Hidden player</span>
                <h2>{answer.name}</h2>
                <p>
                  <FlagIcon nation={answer.nation} /> {answer.nation} · {answer.position} ·{" "}
                  {answer.currentClub}
                </p>
              </div>
              <ClubBadge club={answer.currentClub} />
            </div>
          )}
        </div>
          </section>

          <section className="board" aria-label="Guess comparison board">
        <div className="board__top">
          <div>
            <h2>Comparison board</h2>
            <p>Green is exact. Yellow only means same position family. Red means wrong.</p>
          </div>
          {finished && (
            <button className="play-again" onClick={resetGame}>
              Play again
            </button>
          )}
        </div>

        <div className="table-shell">
          <div className="grid header" style={{ "--cols": columns.length }}>
            <div>Player</div>
            {columns.map((column) => (
              <div key={column.key}>{column.label}</div>
            ))}
          </div>

          <div className="rows">
            {guesses.length === 0 && (
              <div className="empty-state">
                <span>Start typing to make your first guess.</span>
              </div>
            )}

            {guesses.map((guess, index) => (
              <div
                className="grid guess-row"
                style={{ "--cols": columns.length, "--delay": `${index * 70}ms` }}
                key={guess.id}
              >
                <div className="player-cell">
                  <strong>{guess.name}</strong>
                  <small>{guess.nation}</small>
                </div>
                {columns.map((column) => {
                  const result = compareCell(guess, answer, column);
                  return (
                    <div className={`stat-cell ${result.status}`} key={column.key}>
                      <StatValue player={guess} column={column} />
                      {(column.type === "number" || column.type === "money") &&
                        result.direction !== "same" && (
                          <span className="direction" aria-hidden="true">
                            {result.direction === "higher" ? (
                              <ChevronsUp size={16} />
                            ) : (
                              <ChevronsDown size={16} />
                            )}
                          </span>
                        )}
                    </div>
                  );
                })}
              </div>
            ))}

            {Array.from({ length: Math.max(0, MAX_GUESSES - guesses.length) }).map((_, index) => (
              <div
                className="grid placeholder-row"
                style={{ "--cols": columns.length }}
                key={`placeholder-${index}`}
              >
                {Array.from({ length: columns.length + 1 }).map((__, cellIndex) => (
                  <div key={cellIndex} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mobile-guess-list" aria-label="Mobile guess comparison cards">
          {guesses.length === 0 && (
            <div className="empty-state">
              <span>Start typing to make your first guess.</span>
            </div>
          )}

          {guesses.map((guess, index) => (
            <article
              className="mobile-guess-card"
              style={{ "--delay": `${index * 70}ms` }}
              key={`mobile-${guess.id}`}
            >
              <div className="mobile-guess-card__top">
                <div>
                  <strong>{guess.name}</strong>
                  <small>{guess.nation}</small>
                </div>
                <span>#{guesses.length - index}</span>
              </div>

              <div className="mobile-stat-grid">
                {columns.map((column) => {
                  const result = compareCell(guess, answer, column);

                  return (
                    <div className={`mobile-stat ${result.status}`} key={column.key}>
                      <span className="mobile-stat__label">{column.label}</span>
                      <div>
                        <StatValue player={guess} column={column} />
                        {(column.type === "number" || column.type === "money") &&
                          result.direction !== "same" && (
                            <span className="direction" aria-hidden="true">
                              {result.direction === "higher" ? (
                                <ChevronsUp size={16} />
                              ) : (
                                <ChevronsDown size={16} />
                              )}
                            </span>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
        </>
      )}

      {activePage === "predictor" && (
        <PredictorPage />
      )}

      {activePage === "team-maker" && (
        <TeamMakerPage />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <Analytics />
  </>,
);
