"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import "./api-docs.css";

// swagger-ui-react touches `document`/`window` at import time, so it can't be server-rendered.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="api-docs-page">
      <SwaggerUI url="/api/openapi.json" />
    </div>
  );
}
