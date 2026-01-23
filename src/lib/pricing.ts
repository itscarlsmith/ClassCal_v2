type EffectiveRateInput = {
  studentHourlyRate: number | null | undefined
  teacherDefaultHourlyRate: number
}

export const getEffectiveHourlyRate = ({
  studentHourlyRate,
  teacherDefaultHourlyRate,
}: EffectiveRateInput) => {
  return studentHourlyRate ?? teacherDefaultHourlyRate
}

