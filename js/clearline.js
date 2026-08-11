(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const siteNav = document.querySelector("#site-nav");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const refreshIcons = () => {
    if (window.lucide) window.lucide.createIcons();
  };

  const setTheme = (mode, persist = true) => {
    root.dataset.theme = mode;
    if (persist) localStorage.setItem("clearline-theme", mode);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = mode === "dark" ? "#152532" : "#ffffff";
  };

  themeToggle?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  systemTheme.addEventListener("change", (event) => {
    if (!localStorage.getItem("clearline-theme")) {
      setTheme(event.matches ? "dark" : "light", false);
    }
  });

  menuToggle?.addEventListener("click", () => {
    const open = body.classList.toggle("nav-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  siteNav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      body.classList.remove("nav-open");
      menuToggle?.setAttribute("aria-expanded", "false");
    }
  });

  const updateReadingProgress = () => {
    const article = document.querySelector(".article-content");
    if (!article) return;
    const rect = article.getBoundingClientRect();
    const start = window.scrollY + rect.top - 100;
    const length = Math.max(article.offsetHeight - window.innerHeight + 140, 1);
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / length));
    root.style.setProperty("--reading-progress", `${(progress * 100).toFixed(2)}%`);
  };

  if (document.querySelector(".article-content")) {
    updateReadingProgress();
    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    window.addEventListener("resize", updateReadingProgress);
  }

  const tocLinks = [...document.querySelectorAll(".toc-link")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const headingMap = new Map();
    tocLinks.forEach((link) => {
      const id = decodeURIComponent(link.hash.slice(1));
      const heading = document.getElementById(id);
      if (heading) headingMap.set(heading, link);
    });
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).at(-1);
        if (!visible) return;
        tocLinks.forEach((link) => link.classList.remove("is-active"));
        headingMap.get(visible.target)?.classList.add("is-active");
      },
      { rootMargin: "-90px 0px -68% 0px", threshold: 0 }
    );
    headingMap.forEach((_, heading) => observer.observe(heading));
  }

  const enhanceCodeBlocks = () => {
    document.querySelectorAll(".article-content pre, .page-content pre").forEach((pre) => {
      if (pre.dataset.enhanced === "true") return;
      const highlight = pre.closest("figure.highlight");
      let container = pre.parentElement;

      if (highlight) {
        if (!pre.closest("td.code")) return;
        container = highlight;
        if (!highlight.querySelector(":scope > .code-scroll")) {
          const table = highlight.querySelector(":scope > table");
          if (table) {
            const scrollArea = document.createElement("div");
            scrollArea.className = "code-scroll";
            table.before(scrollArea);
            scrollArea.append(table);
          }
        }
      } else if (!container?.classList.contains("sourceCode")) {
        container = document.createElement("div");
        container.className = "code-block";
        pre.before(container);
        container.append(pre);
      }

      pre.dataset.enhanced = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-button copy-code";
      button.dataset.tooltip = "复制代码";
      button.setAttribute("aria-label", "复制代码");
      const icon = document.createElement("i");
      icon.dataset.lucide = "copy";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(pre.innerText);
        button.dataset.tooltip = "已复制";
        button.setAttribute("aria-label", "已复制");
        window.setTimeout(() => {
          button.dataset.tooltip = "复制代码";
          button.setAttribute("aria-label", "复制代码");
        }, 1400);
      });
      container.append(button);
    });
  };

  const imageViewer = document.querySelector("#image-viewer");
  const viewerImage = imageViewer?.querySelector("img");
  document.querySelectorAll(".article-content img, .page-content img, .brevity-images img, .media-card img").forEach((image) => {
    image.addEventListener("click", () => {
      if (!imageViewer || !viewerImage) return;
      viewerImage.src = image.currentSrc || image.src;
      viewerImage.alt = image.alt || "图片预览";
      imageViewer.showModal();
    });
  });
  imageViewer?.querySelector(".image-viewer-close")?.addEventListener("click", () => imageViewer.close());
  imageViewer?.addEventListener("click", (event) => {
    if (event.target === imageViewer) imageViewer.close();
  });

  const initSearch = () => {
    const dialog = document.querySelector("#search-dialog");
    const input = document.querySelector("#search-input");
    const results = document.querySelector("#search-results");
    const status = document.querySelector("#search-status");
    const configNode = document.querySelector("#clearline-search-config");
    if (!dialog || !input || !results || !status || !configNode) return;

    const config = JSON.parse(configNode.textContent);
    let entries = null;

    const open = () => {
      dialog.showModal();
      window.setTimeout(() => input.focus(), 30);
    };

    const close = () => dialog.close();
    document.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", open));
    document.querySelector("[data-search-close]")?.addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dialog.open ? close() : open();
      }
    });

    const loadEntries = async () => {
      if (entries) return entries;
      status.textContent = "正在读取搜索索引";
      const response = await fetch(config.path);
      if (!response.ok) throw new Error(`Search index returned ${response.status}`);
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      entries = [...xml.querySelectorAll("entry")].map((entry) => ({
        title: entry.querySelector("title")?.textContent || "Untitled",
        url: entry.querySelector("url")?.textContent || "/",
        content: entry.querySelector("content")?.textContent || "",
      }));
      return entries;
    };

    const render = async () => {
      const keyword = input.value.trim().toLowerCase();
      results.replaceChildren();
      if (!keyword) {
        status.textContent = "输入关键词开始搜索";
        return;
      }
      try {
        const data = await loadEntries();
        const matches = data
          .filter((entry) => `${entry.title} ${entry.content}`.toLowerCase().includes(keyword))
          .slice(0, 12);
        status.textContent = matches.length ? `找到 ${matches.length} 条结果` : config.empty;
        matches.forEach((entry) => {
          const item = document.createElement("li");
          item.className = "search-result";
          const link = document.createElement("a");
          link.href = entry.url;
          const title = document.createElement("h3");
          title.textContent = entry.title;
          const excerpt = document.createElement("p");
          excerpt.textContent = entry.content.replace(/\s+/g, " ").slice(0, 150);
          link.append(title, excerpt);
          item.append(link);
          results.append(item);
        });
      } catch (error) {
        status.textContent = "搜索索引读取失败，请稍后重试";
        console.error(error);
      }
    };

    let searchTimer;
    input.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(render, 120);
    });
  };

  const initComments = () => {
    const commentRoot = document.querySelector("#twikoo");
    if (!commentRoot || !window.twikoo) return;
    window.twikoo.init({
      envId: commentRoot.dataset.env,
      el: "#twikoo",
      path: window.location.pathname,
    });
  };

  const initRecentComments = async () => {
    const container = document.querySelector("#recent-comments");
    if (!container || !window.twikoo) return;
    try {
      const comments = await window.twikoo.getRecentComments({
        envId: container.dataset.env,
        pageSize: 20,
        includeReply: true,
      });
      container.replaceChildren();
      if (!comments.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "还没有评论";
        container.append(empty);
        return;
      }
      comments.forEach((comment) => {
        const article = document.createElement("article");
        article.className = "recent-comment";
        const avatar = document.createElement("img");
        avatar.src = comment.avatar || "";
        avatar.alt = "";
        const copy = document.createElement("div");
        const head = document.createElement("div");
        head.className = "recent-comment-head";
        const link = document.createElement("a");
        link.href = comment.url || "/";
        link.textContent = comment.nick || "访客";
        const time = document.createElement("time");
        time.textContent = comment.relativeTime || comment.created || "";
        const text = document.createElement("p");
        text.textContent = (comment.comment || "").replace(/<[^>]*>/g, "").slice(0, 180);
        head.append(link, time);
        copy.append(head, text);
        article.append(avatar, copy);
        container.append(article);
      });
    } catch (error) {
      container.textContent = "评论读取失败，请稍后重试";
      console.error(error);
    }
  };

  enhanceCodeBlocks();
  initSearch();
  window.addEventListener("load", () => {
    refreshIcons();
    initComments();
    initRecentComments();
  });
  refreshIcons();
})();
