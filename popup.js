const DIRECT_ID = "direct";

const elements = {
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusText"),
  nodeSelect: document.querySelector("#nodeSelect"),
  nodeDetail: document.querySelector("#nodeDetail"),
  connectButton: document.querySelector("#connectButton"),
  toggleAddButton: document.querySelector("#toggleAddButton"),
  deleteButton: document.querySelector("#deleteButton"),
  addForm: document.querySelector("#addForm"),
  closeAddButton: document.querySelector("#closeAddButton"),
  nameInput: document.querySelector("#nameInput"),
  hostInput: document.querySelector("#hostInput"),
  portInput: document.querySelector("#portInput"),
  message: document.querySelector("#message")
};

let currentState = {
  hosts: [],
  activeProxyId: DIRECT_ID,
  levelOfControl: "controllable_by_this_extension"
};

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Operation failed"));
        return;
      }

      resolve(response.data);
    });
  });
}

function setMessage(text = "", isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
}

function getSelectedHost() {
  return currentState.hosts.find((host) => host.id === elements.nodeSelect.value);
}

function renderSelection() {
  const selectedId = elements.nodeSelect.value;
  const selectedHost = getSelectedHost();
  const isActive = selectedId === currentState.activeProxyId;

  if (selectedId === DIRECT_ID) {
    elements.nodeDetail.textContent = "Use the current network connection";
  } else if (selectedHost) {
    elements.nodeDetail.textContent = `SOCKS5 ${selectedHost.host}:${selectedHost.port}`;
  } else {
    elements.nodeDetail.textContent = "Node configuration not found";
  }

  elements.connectButton.disabled = isActive || (!selectedHost && selectedId !== DIRECT_ID);
  elements.connectButton.textContent = isActive ? "Currently active" : "Apply connection";
  elements.deleteButton.hidden = selectedId === DIRECT_ID;
}

function renderState(preferredSelection) {
  const selectedId =
    preferredSelection || elements.nodeSelect.value || currentState.activeProxyId || DIRECT_ID;

  elements.nodeSelect.replaceChildren();

  const directOption = document.createElement("option");
  directOption.value = DIRECT_ID;
  directOption.textContent = "Direct | No proxy";
  elements.nodeSelect.append(directOption);

  for (const host of currentState.hosts) {
    const option = document.createElement("option");
    option.value = host.id;
    option.textContent = `${host.name}｜${host.host}`;
    elements.nodeSelect.append(option);
  }

  const selectionExists =
    selectedId === DIRECT_ID || currentState.hosts.some((host) => host.id === selectedId);
  elements.nodeSelect.value = selectionExists ? selectedId : DIRECT_ID;
  elements.nodeSelect.disabled = false;

  const activeHost = currentState.hosts.find(
    (host) => host.id === currentState.activeProxyId
  );
  const connected = Boolean(activeHost);

  elements.statusPill.classList.toggle("connected", connected);
  elements.statusText.textContent = connected ? activeHost.name : "Direct";

  renderSelection();
}

async function refreshState(preferredSelection) {
  currentState = await sendMessage({ type: "GET_STATE" });
  renderState(preferredSelection);
}

elements.nodeSelect.addEventListener("change", () => {
  setMessage();
  renderSelection();
});

elements.connectButton.addEventListener("click", async () => {
  const proxyId = elements.nodeSelect.value;
  elements.connectButton.disabled = true;
  elements.connectButton.textContent = "Applying...";
  setMessage();

  try {
    currentState = await sendMessage({ type: "SET_ACTIVE_PROXY", proxyId });
    renderState(proxyId);
    setMessage(
      proxyId === DIRECT_ID
        ? "Direct connection restored"
        : "Proxy applied to Chrome"
    );
  } catch (error) {
    setMessage(error.message, true);
    renderSelection();
  }
});

function showAddForm(show) {
  elements.addForm.hidden = !show;
  elements.toggleAddButton.hidden = show;

  if (show) {
    elements.nameInput.focus();
  }
}

elements.toggleAddButton.addEventListener("click", () => showAddForm(true));
elements.closeAddButton.addEventListener("click", () => showAddForm(false));

elements.addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = elements.addForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  setMessage();

  try {
    const result = await sendMessage({
      type: "ADD_HOST",
      host: {
        name: elements.nameInput.value,
        host: elements.hostInput.value,
        port: elements.portInput.value
      }
    });

    currentState = result.state;
    elements.addForm.reset();
    elements.portInput.value = "1080";
    showAddForm(false);
    renderState(result.newHost.id);
    setMessage("Host added. Select Apply connection to use it.");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save host";
  }
});

elements.deleteButton.addEventListener("click", async () => {
  const selectedHost = getSelectedHost();

  if (!selectedHost) {
    return;
  }

  if (!confirm(`Delete "${selectedHost.name}"?`)) {
    return;
  }

  setMessage();

  try {
    currentState = await sendMessage({
      type: "DELETE_HOST",
      proxyId: selectedHost.id
    });
    renderState(currentState.activeProxyId);
    setMessage("Host deleted");
  } catch (error) {
    setMessage(error.message, true);
  }
});

refreshState().catch((error) => {
  elements.statusText.textContent = "Error";
  setMessage(error.message, true);
});
