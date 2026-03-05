import { AppSidebarInset } from "@/components/navigation/app-sidebar-inset"
import { DashboardClient } from "./_components/dashboard-client"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb";

export const metadata = {
  title: "Dashboard | PXM Sync",
  description: "Overview of your product sync operations, feeds, and integrations",
}

export default function DashboardPage() {
  return (
    <AppSidebarInset
      left={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="p-4">
        <DashboardClient />
      </div>
    </AppSidebarInset>
  )
}
