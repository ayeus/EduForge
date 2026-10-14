import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Raw HTML is not rendered (react-markdown default), so lesson notes can't inject scripts.
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-none text-[15px] leading-7 text-foreground/90",
        "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-xl [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-semibold",
        "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
        "[&_a]:text-ember-hot [&_a]:underline [&_a]:underline-offset-4",
        "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]",
        "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-[#060917] [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-ember [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:text-left [&_td]:border-b [&_td]:border-border/60 [&_td]:py-2",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
