import { Suspense } from "react";
import { Skeleton } from "@/components/Skeleton";
import { DIVISION_LEVEL } from "@/lib/cpi/constants";
import { getAllSeries } from "@/lib/cpi/repository";
import { CalculatorApp } from "./_components/CalculatorApp";

export default async function Page() {
  const categories = await getAllSeries();
  const divisions = categories.filter((c) => c.level === DIVISION_LEVEL);

  return (
    <Suspense fallback={<CalculatorSkeleton />}>
      <CalculatorApp allCategories={categories} divisions={divisions} />
    </Suspense>
  );
}

function CalculatorSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
