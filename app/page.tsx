import { Board } from "@/components/board"
import { ProjectPicker } from "@/components/project-picker"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  return project ? <Board project={project} /> : <ProjectPicker />
}
