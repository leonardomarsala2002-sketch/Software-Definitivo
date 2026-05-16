interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  accent?: boolean;
}

const PageHeader = ({ title, subtitle, children, accent = false }: PageHeaderProps) => (
  <div className={`mb-7 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between ${accent ? "pb-5 border-b border-[#e4e7ec]" : ""}`}>
    <div>
      <h1 className="text-[22px] font-bold tracking-tight text-[#0f1117]">{title}</h1>
      <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>
    </div>
    {children && <div className="mt-3 sm:mt-0 flex items-center gap-2">{children}</div>}
  </div>
);

export default PageHeader;
