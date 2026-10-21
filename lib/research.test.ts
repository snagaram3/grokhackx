import assert from "node:assert/strict";
import { test } from "node:test";
import {
  researchArxivUrl,
  researchPubmedSearchUrl,
  researchPubmedSummaryUrl,
  researchUsptoUrl,
  researchWikiPageUrl,
  researchWikiSearchUrl,
  researchWikiSummaryUrl,
} from "./research";

test("researchWikiSearchUrl encodes q at limit=5 with origin=*", () => {
  assert.equal(
    researchWikiSearchUrl("Camry"),
    "https://en.wikipedia.org/w/api.php?action=opensearch&search=Camry&limit=5&namespace=0&format=json&origin=*",
  );
  assert.equal(
    researchWikiSearchUrl("Toyota Camry"),
    "https://en.wikipedia.org/w/api.php?action=opensearch&search=Toyota%20Camry&limit=5&namespace=0&format=json&origin=*",
  );
  const url = researchWikiSearchUrl("Camry");
  assert.equal(url.includes("limit=10"), false);
  assert.equal(url.includes("limit=8"), false);
  assert.equal(url.includes("origin=*"), true);
});

test("researchWikiPageUrl underscores spaces before encoding", () => {
  assert.equal(researchWikiPageUrl("Camry"), "https://en.wikipedia.org/wiki/Camry");
  assert.equal(
    researchWikiPageUrl("Toyota Camry"),
    "https://en.wikipedia.org/wiki/Toyota_Camry",
  );
  assert.equal(researchWikiPageUrl("Toyota Camry").includes("%20"), false);
  assert.equal(researchWikiPageUrl("C++"), "https://en.wikipedia.org/wiki/C%2B%2B");
  assert.equal(
    researchWikiSummaryUrl("Toyota Camry"),
    "https://en.wikipedia.org/api/rest_v1/page/summary/Toyota_Camry",
  );
  assert.equal(researchWikiSummaryUrl("Toyota Camry").includes("%20"), false);
});

test("researchPubmedSearchUrl encodes term at retmax=6 sort=relevance", () => {
  assert.equal(
    researchPubmedSearchUrl("Camry"),
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Camry&retmax=6&retmode=json&sort=relevance",
  );
  assert.equal(
    researchPubmedSearchUrl("Toyota Camry"),
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Toyota%20Camry&retmax=6&retmode=json&sort=relevance",
  );
  const url = researchPubmedSearchUrl("Camry");
  assert.equal(url.includes("sort=pub_date"), false);
  assert.equal(url.includes("retmax=8"), false);
});

test("researchPubmedSummaryUrl joins ids with a raw comma", () => {
  assert.equal(
    researchPubmedSummaryUrl(["123", "456"]),
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=123,456&retmode=json",
  );
  assert.equal(researchPubmedSummaryUrl(["123", "456"]).includes("%2C"), false);
  assert.equal(
    researchPubmedSummaryUrl([]),
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=&retmode=json",
  );
});

test("researchArxivUrl encodes all: at max_results=6 sortBy=relevance", () => {
  assert.equal(
    researchArxivUrl("Camry"),
    "https://export.arxiv.org/api/query?search_query=all:Camry&start=0&max_results=6&sortBy=relevance&sortOrder=descending",
  );
  assert.equal(
    researchArxivUrl("Toyota Camry"),
    "https://export.arxiv.org/api/query?search_query=all:Toyota%20Camry&start=0&max_results=6&sortBy=relevance&sortOrder=descending",
  );
  const empty = researchArxivUrl("");
  assert.equal(
    empty,
    "https://export.arxiv.org/api/query?search_query=all:&start=0&max_results=6&sortBy=relevance&sortOrder=descending",
  );
  assert.equal(empty.includes("cat%3Acs.AI"), false);
  assert.equal(empty.includes("sortBy=submittedDate"), false);
  assert.equal(empty.includes("max_results=8"), false);
});

test("researchUsptoUrl encodes JSON _text_any at per_page=5", () => {
  assert.equal(
    researchUsptoUrl("Camry"),
    "https://api.patentsview.org/patents/query?q=%7B%22_text_any%22%3A%7B%22patent_title%22%3A%22Camry%22%7D%7D&f=[\"patent_number\",\"patent_title\",\"patent_date\",\"patent_abstract\"]&o={\"per_page\":5}",
  );
  const spaced = researchUsptoUrl("Toyota Camry");
  assert.equal(spaced.includes("Toyota%20Camry"), true);
  assert.equal(spaced.includes("_text_any"), true);
  assert.equal(spaced.includes("per_page"), true);
  assert.equal(spaced.includes("\"size\":5"), false);
  assert.equal(spaced.includes("search.patentsview.org"), false);
});
