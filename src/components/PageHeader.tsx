interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  accent?: boolean;
}

const PageHeader = ({ title, subtitle, children, accent = false }: PageHeaderProps) => (
  <div className={`mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between ${accent ? "pb-5 border-b border-slate-200" : ""}`}>
    <div>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
    </div>
    {children && <div className="mt-3 sm:mt-0 flex items-center gap-2">{children}</div>}
  </div>
);

export default PageHeader;
