interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}

const PageHeader = ({ title, subtitle, children }: PageHeaderProps) => (
  <div className="mb-10 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-[1.65rem] font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
    </div>
    {children && <div className="mt-4 sm:mt-0">{children}</div>}
  </div>
);

export default PageHeader;
