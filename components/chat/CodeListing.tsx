"use client";

export function CodeListing({ value, language }: { value: string; language: string }) {
  return (
    <div className="my-2.5 min-w-0 max-w-full overflow-hidden rounded-[8px] border border-white/[0.1] bg-[#17191d] whitespace-normal">
      <div className="border-b border-white/[0.08] px-3 py-[7px] font-mono text-[10.5px] tracking-[0.04em] text-zinc-500">
        {language}
      </div>
      <pre
        tabIndex={0}
        aria-label={`${language} listing`}
        className="m-0 max-h-72 overflow-auto py-2 font-mono text-[11.5px] leading-[1.75] whitespace-pre focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-sky-400 focus-visible:-outline-offset-2"
      >
        <code>
          {value.split("\n").map((line, index) => (
            <span className="flex min-w-max [&>span:last-child]:pr-3" key={index}>
              <span aria-hidden="true" className="w-10 shrink-0 pr-3 text-right tabular-nums text-zinc-500 opacity-60 select-none">
                {index + 1}
              </span>
              <span className="text-zinc-200">{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
