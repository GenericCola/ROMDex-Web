import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import TaskCommentList from "../../src/components/romdex/task-comment-list";
void test("comments retain desktop classes, timestamp, escaped body and pending treatment", () => {
  const created = Date.UTC(2026, 9, 30, 1, 2);
  const html = renderToStaticMarkup(
    <TaskCommentList
      remoteCount={1}
      comments={[
        {
          id: "4-1",
          text: "<script>not HTML</script>\nsecond line",
          author: "Fixture",
          created,
        },
        {
          id: "pending",
          text: "Local only",
          author: "You · Pending",
          created,
          pending: true,
        },
      ]}
    />,
  );
  assert.match(html, /id="comments"/);
  assert.match(html, /class="comment"/);
  assert.match(html, /class="comment pending"/);
  assert.ok(html.includes(new Date(created).toLocaleString()));
  assert.match(html, /&lt;script&gt;not HTML&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
void test("empty comment placeholder does not falsely describe unread native comments", () => {
  assert.match(
    renderToStaticMarkup(<TaskCommentList comments={[]} remoteCount={0} />),
    /No comments yet/,
  );
  assert.doesNotMatch(
    renderToStaticMarkup(<TaskCommentList comments={[]} remoteCount={5} />),
    /No comments yet/,
  );
});
