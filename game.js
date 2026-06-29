const roleMeta = {
  chief: { name: "族長", short: "族", color: "chief", public: true },
  elder: { name: "長老", short: "長", color: "elder" },
  rebel: { name: "反叛者", short: "反", color: "rebel" },
  heretic: { name: "異教徒", short: "異", color: "heretic" }
};
const characters = ["露娜", "卡伊", "月林守衛", "沙境旅人", "聖湖祭司", "影裔獵手", "狼牙長老"];
const portraits = ["image1.jpg", "image2.jpg", "image3.jpg", "image4.jpg", "image5.jpg", "image6.jpg"];
const cardText = {
  attack: ["攻", "指定一名玩家。若對方沒有防，理智 -1。"],
  defense: ["防", "抵禦一次攻擊。AI 會自動使用。"],
  moonBlood: ["月神之血", "自己回復 1 點理智。"],
  shadowBlood: ["影神之血", "自己 -1，指定目標 -1。"],
  gift: ["月神的餽贈", "立刻抽 2 張牌。"],
  whisper: ["影神的低語", "指定目標棄 1 張牌，你抽 1 張。"],
  desert: ["沙漠蔓延", "指定目標棄 1 張牌。"],
  luna: ["露娜的祝福", "所有存活者回復 1 點理智。"]
};
const state = { players: [], deck: [], hand: [], selectedCard: null, turn: 0, round: 1, attacksThisTurn: 0, drewThisTurn: false, over: false };
const $ = (id) => document.getElementById(id);
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function setupRoles(count) {
  if (count === 5) return ["chief", "elder", "rebel", "rebel", "heretic"];
  if (count === 6) return ["chief", "elder", "rebel", "rebel", "rebel", "heretic"];
  return ["chief", "elder", "elder", "rebel", "rebel", "rebel", "heretic"];
}
function makeDeck() {
  return shuffle([
    ...Array(18).fill("attack"), ...Array(14).fill("defense"),
    ...Array(3).fill("moonBlood"), ...Array(3).fill("shadowBlood"),
    ...Array(3).fill("gift"), ...Array(3).fill("whisper"),
    ...Array(3).fill("desert"), ...Array(2).fill("luna")
  ]);
}
function drawOne() {
  if (!state.deck.length) state.deck = makeDeck();
  return state.deck.pop();
}
function addLog(text) {
  const li = document.createElement("li");
  li.textContent = text;
  $("log").prepend(li);
}
function newGame() {
  const count = Number($("player-count").value);
  const roles = setupRoles(count);
  const hidden = shuffle(roles.slice(1));
  state.players = [];
  for (let i = 0; i < count; i++) {
    const role = i === 0 ? "chief" : hidden[i - 1];
    state.players.push({
      id: i,
      name: i === 0 ? "你" : `玩家 ${i + 1}`,
      character: characters[i],
      portrait: portraits[i % portraits.length],
      role,
      revealed: i === 0,
      sanity: role === "chief" ? 5 : 3,
      maxSanity: role === "chief" ? 5 : 3,
      hand: Array.from({ length: 4 }, drawOne)
    });
  }
  state.deck = makeDeck();
  state.hand = Array.from({ length: 5 }, drawOne);
  Object.assign(state, { selectedCard: null, turn: 0, round: 1, attacksThisTurn: 0, drewThisTurn: false, over: false });
  $("log").innerHTML = "";
  addLog("新一輪議會開始。族長身分公開，其餘玩家保持隱藏。");
  render();
}
function alivePlayers() { return state.players.filter(p => p.sanity > 0); }
function livingTargets(exceptId) { return alivePlayers().filter(p => p.id !== exceptId); }
function revealIfNeeded(player) {
  if (player.sanity <= 0 && !player.revealed) {
    player.revealed = true;
    addLog(`${player.name} 理智清空，揭示身分：${roleMeta[player.role].name}。`);
  }
  const alive = alivePlayers();
  if (alive.length <= 2 && alive.some(p => p.role === "chief")) {
    alive.forEach(p => p.revealed = true);
  }
}
function damage(target, amount, source = "攻擊") {
  if (!target || target.sanity <= 0) return;
  target.sanity = Math.max(0, target.sanity - amount);
  addLog(`${target.name} 因${source}失去 ${amount} 點理智。`);
  revealIfNeeded(target);
}
function heal(target, amount) {
  if (!target || target.sanity <= 0) return;
  const before = target.sanity;
  target.sanity = Math.min(target.maxSanity, target.sanity + amount);
  addLog(`${target.name} 回復 ${target.sanity - before} 點理智。`);
}
function hasDefense(player) {
  const i = player.hand.indexOf("defense");
  if (i >= 0) { player.hand.splice(i, 1); return true; }
  return false;
}
function removeFromHand(index) {
  const [card] = state.hand.splice(index, 1);
  state.selectedCard = null;
  return card;
}
function playCard(cardIndex, targetId = null) {
  if (state.over || state.turn !== 0) return;
  const card = state.hand[cardIndex];
  if (!card) return;
  const needsTarget = ["attack", "shadowBlood", "whisper", "desert"].includes(card);
  if (needsTarget && targetId === null) {
    state.selectedCard = cardIndex;
    $("hint").textContent = `請指定「${cardText[card][0]}」的目標。`;
    render();
    return;
  }
  const target = state.players[targetId];
  if (needsTarget && (!target || target.id === 0 || target.sanity <= 0)) return;
  if (card === "attack" && state.attacksThisTurn >= 1) {
    addLog("每回合只能使用一次攻。"); render(); return;
  }
  removeFromHand(cardIndex);
  resolvePlayerCard(card, target);
  checkVictory();
  render();
}
function resolvePlayerCard(card, target) {
  if (card === "attack") {
    state.attacksThisTurn++;
    if (hasDefense(target)) addLog(`${target.name} 打出防，擋下你的攻。`);
    else damage(target, 1, "你的攻");
  }
  if (card === "moonBlood") heal(state.players[0], 1);
  if (card === "shadowBlood") { damage(state.players[0], 1, "影神之血"); damage(target, 1, "影神之血"); }
  if (card === "gift") { state.hand.push(drawOne(), drawOne()); addLog("月神的餽贈讓你抽了 2 張牌。"); }
  if (card === "whisper") { discardAiCard(target); state.hand.push(drawOne()); addLog(`你聽見影神低語，干擾 ${target.name} 並抽 1 張牌。`); }
  if (card === "desert") { discardAiCard(target); addLog(`沙漠蔓延迫使 ${target.name} 棄牌。`); }
  if (card === "luna") alivePlayers().forEach(p => heal(p, 1));
}
function discardAiCard(player) {
  if (player.hand.length) player.hand.splice(Math.floor(Math.random() * player.hand.length), 1);
}
function render() {
  $("round-label").textContent = state.round;
  $("turn-label").textContent = state.over ? "結束" : state.players[state.turn]?.name || "族長";
  $("draw-card").disabled = state.over || state.turn !== 0 || state.drewThisTurn;
  $("end-turn").disabled = state.over || state.turn !== 0;
  renderPlayers(); renderHand();
}
function renderPlayers() {
  const box = $("players"); box.innerHTML = "";
  const tpl = $("player-template");
  state.players.forEach(p => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-dead", p.sanity <= 0);
    node.classList.toggle("is-active", p.id === state.turn && !state.over);
    node.classList.toggle("is-selected", state.selectedCard !== null && p.id !== 0 && p.sanity > 0);
    node.querySelector("img").src = `assets/${p.portrait}`;
    node.querySelector("img").alt = p.character;
    node.querySelector("h3").textContent = `${p.name} · ${p.character}`;
    const known = p.revealed ? roleMeta[p.role].name : "身分隱藏";
    node.querySelector(".role-line").textContent = p.id === 0 ? "公開身分：族長" : known;
    const badge = node.querySelector(".identity-badge");
    badge.textContent = p.revealed ? roleMeta[p.role].short : "?";
    badge.classList.add(p.revealed ? roleMeta[p.role].color : "hidden-role");
    const sanity = node.querySelector(".sanity");
    for (let i = 0; i < p.maxSanity; i++) {
      const h = document.createElement("span");
      h.className = `heart${i >= p.sanity ? " empty" : ""}`;
      sanity.appendChild(h);
    }
    node.querySelector(".target-button").disabled = state.selectedCard === null || p.id === 0 || p.sanity <= 0 || state.over;
    node.querySelector(".target-button").addEventListener("click", () => playCard(state.selectedCard, p.id));
    box.appendChild(node);
  });
}
function renderHand() {
  const box = $("hand"); box.innerHTML = "";
  state.hand.forEach((card, index) => {
    const [name, desc] = cardText[card];
    const btn = document.createElement("button");
    btn.className = `card-button${state.selectedCard === index ? " selected" : ""}`;
    btn.dataset.kind = card === "attack" ? "attack" : card === "defense" ? "defense" : "item";
    btn.innerHTML = `<strong>${name}</strong><span>${desc}</span>`;
    btn.disabled = state.over || state.turn !== 0 || card === "defense";
    btn.addEventListener("click", () => playCard(index));
    box.appendChild(btn);
  });
  if (!state.hand.length) box.textContent = "手牌已空。";
}
function nextTurn() {
  if (state.over) return;
  state.selectedCard = null;
  let next = state.turn;
  do { next = (next + 1) % state.players.length; } while (state.players[next].sanity <= 0);
  state.turn = next;
  if (state.turn === 0) {
    state.round++;
    state.attacksThisTurn = 0;
    state.drewThisTurn = false;
    addLog("輪到你行動。抽牌、攻擊或使用道具。");
    render();
  } else {
    render();
    setTimeout(aiTurn, 550);
  }
}
function aiTurn() {
  if (state.over) return;
  const ai = state.players[state.turn];
  ai.hand.push(drawOne());
  let target = chooseAiTarget(ai);
  const useShadow = ai.hand.includes("shadowBlood") && ai.sanity > 1 && target;
  const attackIndex = ai.hand.indexOf("attack");
  if (useShadow && Math.random() < .35) {
    ai.hand.splice(ai.hand.indexOf("shadowBlood"), 1);
    damage(ai, 1, "影神之血"); damage(target, 1, `${ai.name} 的影神之血`);
  } else if (attackIndex >= 0 && target) {
    ai.hand.splice(attackIndex, 1);
    if (target.id === 0 && state.hand.includes("defense")) {
      state.hand.splice(state.hand.indexOf("defense"), 1);
      addLog(`${ai.name} 對你打出攻，你以防抵禦。`);
    } else if (hasDefense(target)) addLog(`${ai.name} 攻擊 ${target.name}，但被防擋下。`);
    else damage(target, 1, `${ai.name} 的攻`);
  } else if (ai.hand.includes("moonBlood") && ai.sanity < ai.maxSanity) {
    ai.hand.splice(ai.hand.indexOf("moonBlood"), 1); heal(ai, 1);
  } else addLog(`${ai.name} 觀望局勢，沒有出手。`);
  while (ai.hand.length > 5) ai.hand.shift();
  checkVictory();
  nextTurn();
}
function chooseAiTarget(ai) {
  const targets = livingTargets(ai.id);
  if (!targets.length) return null;
  const chief = targets.find(p => p.role === "chief");
  if (ai.role === "rebel" && chief) return chief;
  if (ai.role === "elder") return targets.filter(p => p.role !== "chief").sort((a,b) => a.sanity - b.sanity)[0] || null;
  if (ai.role === "heretic") return targets.filter(p => p.role !== "chief").sort((a,b) => a.sanity - b.sanity)[0] || chief;
  return targets[Math.floor(Math.random() * targets.length)];
}
function checkVictory() {
  state.players.forEach(revealIfNeeded);
  const alive = alivePlayers();
  const chief = state.players.find(p => p.role === "chief");
  if (chief.sanity <= 0) {
    const othersAlive = alive.filter(p => p.role !== "chief");
    const hereticAlive = alive.find(p => p.role === "heretic");
    endGame(hereticAlive && othersAlive.length === 1 ? "異教徒完成最後清算，奪取部落。" : "族長理智歸零，反叛者勝利。", false);
    return true;
  }
  if (alive.every(p => ["chief", "elder"].includes(p.role))) {
    endGame("族長與長老守住議會，部落回到月林秩序。", true);
    return true;
  }
  return false;
}
function endGame(text, won) {
  state.over = true;
  state.players.forEach(p => p.revealed = true);
  $("result-text").textContent = won ? `勝利：${text}` : `失敗：${text}`;
  addLog(text);
  render();
}
$("new-game").addEventListener("click", newGame);
$("draw-card").addEventListener("click", () => { if (!state.drewThisTurn) { state.hand.push(drawOne()); state.drewThisTurn = true; addLog("你從牌池抽了 1 張牌。"); render(); } });
$("end-turn").addEventListener("click", () => { while (state.hand.length > 5) state.hand.shift(); nextTurn(); });
$("clear-log").addEventListener("click", () => $("log").innerHTML = "");
newGame();
