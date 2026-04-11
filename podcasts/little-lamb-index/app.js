const state = {
  data: null,
  selectedBook: null,
  selectedChapter: null,
  query: ""
};

const elements = {
  searchInput: document.getElementById("search-input"),
  clearSearch: document.getElementById("clear-search"),
  bookList: document.getElementById("book-list"),
  chapterList: document.getElementById("chapter-list"),
  chapterResults: document.getElementById("chapter-results"),
  searchResults: document.getElementById("search-results"),
  browserTitle: document.getElementById("browser-title"),
  browserSummary: document.getElementById("browser-summary"),
  searchSummary: document.getElementById("search-summary"),
  bookSummary: document.getElementById("book-summary"),
  template: document.getElementById("episode-card-template")
};

function readerClass(readerKey) {
  return readerKey === "qingqing-jiejie" ? "reader-qingqing" : "reader-xiafan";
}

function buildEpisodeCard(episode) {
  const fragment = elements.template.content.cloneNode(true);
  fragment.querySelector(".episode-date").textContent = episode.displayDate;
  const reader = fragment.querySelector(".episode-reader");
  reader.textContent = episode.readerLabel ? episode.readerLabel.split("|")[0].trim() : "未知";
  reader.className = `episode-reader ${readerClass(episode.readerKey)}`.trim();
  fragment.querySelector(".episode-title").textContent = `${episode.titleZh} | ${episode.titleEn}`;
  const subtitle = fragment.querySelector(".episode-subtitle");
  subtitle.textContent = episode.pinyin;
  fragment.querySelector(".episode-reference").textContent = episode.reference;
  const notes = fragment.querySelector(".episode-notes");
  if (episode.notes) {
    notes.textContent = episode.notes;
  } else {
    notes.remove();
  }
  const audio = fragment.querySelector(".audio-link");
  audio.href = episode.audioUrl;
  const source = fragment.querySelector(".source-link");
  if (episode.sourcePageUrl) {
    source.href = episode.sourcePageUrl;
  } else {
    source.href = episode.audioUrl;
    source.textContent = "Archive";
  }
  return fragment;
}

function renderResults(container, episodes, emptyText) {
  container.innerHTML = "";
  if (episodes.length === 0) {
    container.classList.add("empty-state");
    container.textContent = emptyText;
    return;
  }

  container.classList.remove("empty-state");
  const fragment = document.createDocumentFragment();
  episodes.forEach((episode) => fragment.appendChild(buildEpisodeCard(episode)));
  container.appendChild(fragment);
}

function booksForBrowse() {
  return state.data.bookOrder
    .map((book) => ({
      book,
      count: state.data.episodes.filter((episode) =>
        episode.books.some((entry) => entry.book === book)
      ).length
    }))
    .filter((entry) => entry.count > 0);
}

function chaptersForBook(book) {
  const chapters = new Set();
  state.data.episodes.forEach((episode) => {
    episode.books
      .filter((entry) => entry.book === book)
      .forEach((entry) => entry.chapters.forEach((chapter) => chapters.add(chapter)));
  });
  return [...chapters].sort((a, b) => a - b);
}

function episodesForChapter(book, chapter) {
  return state.data.episodes
    .filter((episode) =>
      episode.books.some(
        (entry) => entry.book === book && entry.chapters.includes(chapter)
      )
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

function scoreEpisode(episode, query) {
  let score = 0;
  const q = query.toLowerCase();
  const titleEn = episode.titleEn.toLowerCase();
  const titleZh = episode.titleZh.toLowerCase();
  const reference = episode.reference.toLowerCase();
  const pinyin = episode.pinyin.toLowerCase();

  if (titleEn.includes(q)) score += 12;
  if (titleZh.includes(q)) score += 12;
  if (reference.includes(q)) score += 9;
  if (pinyin.includes(q)) score += 8;
  if (episode.searchText.includes(q)) score += 4;
  return score;
}

function searchEpisodes(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return state.data.episodes
    .map((episode) => ({ episode, score: scoreEpisode(episode, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.episode.date.localeCompare(a.episode.date))
    .slice(0, 60)
    .map((entry) => entry.episode);
}

function renderBooks() {
  const books = booksForBrowse();
  elements.bookSummary.textContent = `${books.length} books with mapped episodes`;
  elements.bookList.innerHTML = "";

  books.forEach(({ book, count }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `book-button ${state.selectedBook === book ? "active" : ""}`.trim();
    button.textContent = `${book} (${count})`;
    button.addEventListener("click", () => {
      state.selectedBook = book;
      const chapters = chaptersForBook(book);
      state.selectedChapter = chapters[0] || null;
      render();
    });
    elements.bookList.appendChild(button);
  });
}

function renderBrowse() {
  if (!state.selectedBook) {
    elements.browserTitle.textContent = "Browse";
    elements.browserSummary.textContent = "Choose a Bible book to see chapter links.";
    elements.chapterList.innerHTML = "";
    renderResults(elements.chapterResults, [], "Choose a book and chapter.");
    return;
  }

  const chapters = chaptersForBook(state.selectedBook);
  if (!chapters.includes(state.selectedChapter)) {
    state.selectedChapter = chapters[0] || null;
  }

  elements.browserTitle.textContent = state.selectedBook;
  elements.browserSummary.textContent = `${chapters.length} chapter view${chapters.length === 1 ? "" : "s"} available`;
  elements.chapterList.innerHTML = "";
  chapters.forEach((chapter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chapter-button ${state.selectedChapter === chapter ? "active" : ""}`.trim();
    button.textContent = chapter;
    button.addEventListener("click", () => {
      state.selectedChapter = chapter;
      renderBrowse();
    });
    elements.chapterList.appendChild(button);
  });

  const episodes = state.selectedChapter
    ? episodesForChapter(state.selectedBook, state.selectedChapter)
    : [];
  renderResults(
    elements.chapterResults,
    episodes,
    "No reviewed episodes are mapped to this chapter yet."
  );
}

function renderSearch() {
  const query = state.query.trim();
  if (!query) {
    elements.searchSummary.textContent = "Type to search the archive.";
    renderResults(elements.searchResults, [], "Search results will appear here.");
    return;
  }
  const results = searchEpisodes(query);
  elements.searchSummary.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”`;
  renderResults(elements.searchResults, results, "No search matches found.");
}

function render() {
  renderBooks();
  renderBrowse();
  renderSearch();
}

async function load() {
  const response = await fetch("./episodes.json");
  state.data = await response.json();
  const books = booksForBrowse();
  state.selectedBook = books[0]?.book || null;
  state.selectedChapter = state.selectedBook ? chaptersForBook(state.selectedBook)[0] : null;
  render();
}

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderSearch();
});

elements.clearSearch.addEventListener("click", () => {
  state.query = "";
  elements.searchInput.value = "";
  renderSearch();
});

load().catch((error) => {
  elements.searchResults.classList.add("empty-state");
  elements.searchResults.textContent = `Failed to load episode index: ${error.message}`;
});
