"""Download four explicitly selected public notices, never crawl or follow attachments."""
import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

SOURCES = [
    ("admissions-402-2026", "admissions", "2026-02-10", "https://tuyensinh.vku.udn.vn/thong-bao/69af034de1fedb5e0308e872"),
    ("admissions-entry-2026", "admissions", "2026-08-09", "https://tuyensinh.vku.udn.vn/thong-bao/6a79472c0619ded1f20e9b44"),
    ("academic-graduation-3-2026", "academic", "2026-06-16", "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-3-nam-2026-1358.html"),
    ("academic-graduation-4-2026", "academic", "2026-09-13", "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-4-nam-2026-1385.html"),
]


class Node:
    def __init__(self, tag="root", attrs=(), start=0):
        self.tag, self.attrs, self.start, self.end = tag, dict(attrs), start, 0
        self.children = []

    def nodes(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.nodes()

    def text(self):
        if self.tag in {"script", "style", "img"}:
            return ""
        return "".join(c.text() if isinstance(c, Node) else c for c in self.children)


class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.html = html
        self.lines = [0]
        self.lines.extend(m.end() for m in re.finditer("\n", html))
        self.feed(html)

    def source_position(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.source_position())
        self.stack[-1].children.append(node)
        if tag not in {"img", "br", "hr", "meta", "link", "input", "source", "wbr", "embed"}:
            self.stack.append(node)
        else:
            node.end = self.source_position() + len(self.get_starttag_text())

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack[i].end = self.source_position() + len(tag) + 3
                del self.stack[i:]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def table_rows(node):
    rows, spans = [], {}
    for row in node.nodes():
        if row.tag != "tr":
            continue
        values = {col: value for col, (value, remaining) in spans.items()}
        future = {col: (value, remaining - 1) for col, (value, remaining) in spans.items() if remaining > 1}
        col = 0
        for cell in row.children:
            if not isinstance(cell, Node) or cell.tag not in {"td", "th"}:
                continue
            while col in values:
                col += 1
            value = clean(cell.text()).replace("|", "\\|")
            for _ in range(int(cell.attrs.get("colspan", "1"))):
                values[col] = value
                remaining = int(cell.attrs.get("rowspan", "1")) - 1
                if remaining:
                    future[col] = (value, remaining)
                col += 1
        spans = future
        if values:
            rows.append([values.get(i, "") for i in range(max(values) + 1)])
    width = max(map(len, rows), default=0)
    return [row + [""] * (width - len(row)) for row in rows]


def render(node):
    if isinstance(node, str):
        return node
    if node.tag in {"script", "style", "img", "figure"}:
        return ""
    if node.tag == "table":
        rows = ["| " + " | ".join(row) + " |" for row in table_rows(node)]
        if rows:
            rows.insert(1, "| " + " | ".join("---" for _ in rows[0].split('|')[1:-1]) + " |")
        return "\n\n" + "\n".join(rows) + "\n\n"
    text = "".join(render(c) for c in node.children)
    if node.tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        return "\n\n" + "#" * int(node.tag[1]) + " " + clean(text) + "\n\n"
    # Numbered section labels in the original are preserved; no invented headings/pages.
    if node.tag in {"p", "div", "li", "ul", "ol"}:
        if node.tag == "p" and re.match(r"^\d+\.(?:\d+\.)?\s+\S", clean(text)):
            return "\n\n## " + clean(text) + "\n\n"
        return "\n" + text + "\n"
    if node.tag == "br":
        return "\n"
    if node.tag == "a" and node.attrs.get("href", "").startswith("http"):
        return text + " (" + node.attrs["href"] + ")"
    return text


def convert(html, category):
    tree = Tree(html)
    nodes = list(tree.root.nodes())
    if category == "admissions":
        candidates = [n for n in nodes if "content-detail" in n.attrs.get("class", "").split()]
        # Article title precedes content-detail in this explicitly selected page layout.
        titles = [n for n in nodes if n.tag in {"h1", "h2"} and n.start < candidates[0].start] if candidates else []
        title = clean(titles[-1].text()) if titles else ""
    else:
        candidates = [n for n in nodes if n.attrs.get("property") == "content:encoded"]
        titles = [n for n in nodes if n.attrs.get("id") == "page-title"]
        title = clean(titles[0].text()) if titles else ""
    if len(candidates) != 1 or not title or not candidates[0].end:
        raise ValueError("Source layout changed; manual main-content selection required")
    node = candidates[0]
    text = render(node)
    text = "\n".join(re.sub(r"[^\S\n]+", " ", line).strip() for line in text.splitlines())
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    text = re.sub(r"Ẩn bớt\s*$", "", text).rstrip()
    if len(text) < 200:
        raise ValueError("Article content incomplete")
    # Keep only source article HTML. Exclude menus, unrelated student testimonials and lists.
    original_fragment = html[node.start:node.end]
    return title, f"# {title}\n\n{text}\n", original_fragment


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare(output: Path, from_saved=False):
    raw, documents = output / "raw", output / "documents"
    raw.mkdir(parents=True, exist_ok=True)
    documents.mkdir(exist_ok=True)
    manifest, catalog = [], []
    for document_id, category, publication_date, url in SOURCES:
        try:
            if from_saved:
                body = (raw / f"{document_id}.html").read_bytes()
            else:
                with urlopen(Request(url, headers={"User-Agent": "VKU-Assist-pilot/1.0"}), timeout=30) as response:
                    body = response.read(5_000_001)
                if len(body) > 5_000_000:
                    raise ValueError("Page exceeds bounded download size")
            title, markdown, fragment = convert(body.decode("utf-8-sig"), category)
            saved_at = datetime.now(timezone.utc).isoformat()
            content_hash = digest(markdown.encode())
            version = f"html-snapshot-{content_hash[:12]}"
            (raw / f"{document_id}.html").write_text(fragment, encoding="utf-8", newline="\n")
            file = documents / f"{document_id}.md"
            file.write_text(markdown, encoding="utf-8", newline="\n")
            manifest.append(dict(file=file.name, document_id=document_id, title=title,
                source_url=url, category=category, applicable_year=2026, document_version=version))
            catalog.append(dict(**manifest[-1], original_file_url=None, issued_date=None,
                publication_date=publication_date, retrieved_at=saved_at, content_hash=content_hash,
                response_sha256=digest(body), original_fragment_sha256=digest(fragment.encode()),
                conversion="prepare_vku_pilot.py: main article only; images omitted; HTML has no page numbers",
                scope_note="2026 explicitly in article; academic year denotes graduation round, not intake cohort. Notices are historical, not current deadlines.",
                review_status="codex_draft_pending_thu_trang_and_second_reviewer",
                validity_status="not_confirmed_current; verify amendments and attachments manually",
                attachment_urls=[n.attrs['href'] for n in Tree(fragment).root.nodes()
                                 if n.tag == 'a' and 'drive.google.com/' in n.attrs.get('href', '')],
                omitted_images=bool(re.search(r"<(?:img|figure)\b", fragment, re.I))))
        except Exception as error:
            catalog.append(dict(document_id=document_id, source_url=url, error_type=type(error).__name__,
                                status="blocked_or_conversion_failed; place verified file manually"))
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "source_catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"documents": len(manifest), "failed": len(SOURCES) - len(manifest)}, ensure_ascii=True))
    return 0 if len(manifest) == len(SOURCES) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('backend/data/vku-pilot'))
    args = parser.parse_args()
    raise SystemExit(prepare(args.output))
