"use client";

import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { VideoDateFilter } from "@/components/video-dashboard/VideoDateFilter";
import { VideoKpiCards } from "@/components/video-dashboard/VideoKpiCards";
import { HookRanking } from "@/components/video-dashboard/HookRanking";
import { FunnelRetentionMap } from "@/components/video-dashboard/FunnelRetentionMap";
import { CreativeLibrary } from "@/components/video-dashboard/CreativeLibrary";
import { CreativeFatigue } from "@/components/video-dashboard/CreativeFatigue";

export default function VideoTab() {
  return (
    <DateFilterProvider>
      <div className="space-y-6">
        <div className="flex justify-end">
          <VideoDateFilter />
        </div>
        <VideoKpiCards />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <HookRanking />
          </div>
          <div className="lg:col-span-3">
            <FunnelRetentionMap />
          </div>
        </div>
        <CreativeLibrary />
        <CreativeFatigue />
      </div>
    </DateFilterProvider>
  );
}
