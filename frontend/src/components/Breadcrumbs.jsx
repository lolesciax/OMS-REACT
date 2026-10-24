import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function Breadcrumbs({ items, label = "Breadcrumb" }) {
  return (
    <nav aria-label={label} className="commerce-breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}:${index}`}>
            {index > 0 && <Icon name="chevron" size={12} />}
            {item.to ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
