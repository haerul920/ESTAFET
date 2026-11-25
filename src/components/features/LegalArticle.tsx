import { Fragment } from "react";
import { sectionAnchor, type LegalDocName, type LegalText } from "@/lib/legal/content";
import { parseBlocks, parseInline } from "@/lib/legal/markup";

function Line({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.type === "bold" ? (
          <strong key={i}>{part.value}</strong>
        ) : part.type === "code" ? (
          <code key={i} className="font-code">
            {part.value}
          </code>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        ),
      )}
    </>
  );
}

/** A legal document as readers see it. The public page and the admin preview both use this, so they cannot differ. */
export function LegalArticle({ doc, text }: { doc: LegalDocName; text: LegalText }) {
  return (
    <>
      <h1 className="mb-3 mt-0 text-[36px] font-medium max-sm:text-[28px]">{text.title}</h1>
      <p className="mb-8 mt-0 text-lg text-text-2">{text.lead}</p>
      <div className="flex flex-col gap-6 text-[16px] leading-relaxed">
        {text.sections.map((section) => {
          const anchor = sectionAnchor(doc, section.id);
          return (
            <section key={section.id} id={anchor} aria-labelledby={`${anchor}-h`} className="scroll-mt-28">
              <h2 id={`${anchor}-h`} className="mb-1 mt-0 text-xl">
                {section.h}
              </h2>
              <div className="flex flex-col gap-3">
                {parseBlocks(section.body).map((block, i) =>
                  block.type === "ul" ? (
                    <ul key={i} className="m-0 flex list-disc flex-col gap-2 pl-5">
                      {block.items.map((item, j) => (
                        <li key={j}>
                          <Line text={item} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="m-0">
                      {block.lines.map((line, j) => (
                        <Fragment key={j}>
                          {j > 0 ? <br /> : null}
                          <Line text={line} />
                        </Fragment>
                      ))}
                    </p>
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
