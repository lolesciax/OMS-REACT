import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Link to="/">Old Goods Thrift.</Link>
          <p>
            A second life for good clothes.
            <br />A little more character for your wardrobe.
          </p>
          <span>
            <Icon name="leaf" size={16} /> Pre-loved, thoughtfully chosen.
          </span>
        </div>
        <div>
          <h2>Find your way</h2>
          <Link to="/">Shop the collection</Link>
          <Link to="/order-history">Your orders</Link>
          <Link to="/profile">Your account</Link>
        </div>
        <div>
          <h2>Say hello</h2>
          <a href="mailto:oldgoodsthrift@gmail.com">oldgoodsthrift@gmail.com</a>
          <a href="tel:09099409746">0909 940 9746</a>
          <p>
            Marilao, Bulacan
            <br />
            Mon–Sat · 9 AM–6 PM
          </p>
        </div>
        <div>
          <h2>Keep in touch</h2>
          <a
            href="https://www.facebook.com/oldgoodsthrift"
            target="_blank"
            rel="noreferrer"
          >
            Facebook ↗
          </a>
          <a
            href="https://www.instagram.com/oldgoodsthrift.ph/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram ↗
          </a>
          <a
            href="https://www.tiktok.com/@oldgoodsthrift_23"
            target="_blank"
            rel="noreferrer"
          >
            TikTok ↗
          </a>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Old Goods Thrift</span>
        <span>GCash & Maya payments · Nationwide shipping</span>
      </div>
    </footer>
  );
}
