import { type ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="text-center py-12 animate-fade-in">
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <p className="text-lg font-medium text-base-content/70">{title}</p>
      {description && <p className="text-sm text-base-content/50 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
