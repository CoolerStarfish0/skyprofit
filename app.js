const styleDescriptions = {
  money: "Prioritizing the highest realistic profit, regardless of effort.",
  chill: "Prioritizing low-effort methods such as flipping and passive income.",
  balanced: "Balancing earning potential with time, effort and setup cost.",
  active: "Prioritizing active gameplay methods you can participate in."
};

document.querySelectorAll(".playstyle").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".playstyle").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    const note = document.getElementById("style-note");
    note.textContent = styleDescriptions[button.dataset.style] || styleDescriptions.money;
    try { localStorage.setItem("skyprofit-playstyle", button.dataset.style); } catch {}
  });
});

try {
  const saved = localStorage.getItem("skyprofit-playstyle");
  if (saved) {
    const button = document.querySelector(`.playstyle[data-style="${saved}"]`);
    if (button) button.click();
  }
} catch {}

document.getElementById("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("username");
  const message = document.getElementById("profile-message");
  const username = input.value.trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) {
    message.textContent = "Enter a valid Minecraft username (1–16 letters, numbers or underscores).";
    message.style.color = "#f0a18b";
    return;
  }
  message.textContent = `Username saved: ${username}. Profile lookup will be enabled when the data integration is connected.`;
  message.style.color = "#a3ef75";
  try { localStorage.setItem("skyprofit-username", username); } catch {}
});

try {
  const savedUsername = localStorage.getItem("skyprofit-username");
  if (savedUsername) document.getElementById("username").value = savedUsername;
} catch {}
