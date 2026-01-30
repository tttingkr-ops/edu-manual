// Created: 2026-01-27 17:10:00
// Updated: 2026-01-29 - Server Actions 연동, Auth 통합
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createUserAction, updateUserAction, deleteUserAction, resetPasswordAction } from './actions'

interface User {
  id: string
  username: string
  role: 'admin' | 'manager'
  name: string
  created_at: string
}

interface UsersContentProps {
  users: User[]
}

export default function UsersContent({ users: initialUsers }: UsersContentProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    name: '',
    role: 'manager' as 'admin' | 'manager',
  })
  const [newPassword, setNewPassword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'manager'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 필터링된 사용자 목록
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesRole
  })

  // 모달 열기 (추가)
  const openAddModal = () => {
    setEditingUser(null)
    setFormData({ email: '', password: '', username: '', name: '', role: 'manager' })
    setError(null)
    setShowModal(true)
  }

  // 모달 열기 (수정)
  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: '',
      password: '',
      username: user.username,
      name: user.name,
      role: user.role,
    })
    setError(null)
    setShowModal(true)
  }

  // 모달 닫기
  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({ email: '', password: '', username: '', name: '', role: 'manager' })
    setError(null)
  }

  // 비밀번호 재설정 모달 열기
  const openPasswordModal = (user: User) => {
    setPasswordResetUser(user)
    setNewPassword('')
    setError(null)
    setShowPasswordModal(true)
  }

  // 비밀번호 재설정 모달 닫기
  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordResetUser(null)
    setNewPassword('')
    setError(null)
  }

  // 폼 제출 - Server Actions 사용
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (editingUser) {
        // 수정
        const result = await updateUserAction({
          userId: editingUser.id,
          username: formData.username,
          name: formData.name,
          role: formData.role,
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        setUsers(users.map((u) =>
          u.id === editingUser.id
            ? { ...u, username: formData.username, name: formData.name, role: formData.role }
            : u
        ))
      } else {
        // 추가 - Auth와 함께 사용자 생성
        if (!formData.email || !formData.password) {
          throw new Error('이메일과 비밀번호는 필수입니다.')
        }

        if (formData.password.length < 6) {
          throw new Error('비밀번호는 6자 이상이어야 합니다.')
        }

        const result = await createUserAction({
          email: formData.email,
          password: formData.password,
          username: formData.username,
          name: formData.name,
          role: formData.role,
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        // 새 사용자 추가
        setUsers([{
          id: result.userId!,
          username: formData.username,
          name: formData.name,
          role: formData.role,
          created_at: new Date().toISOString(),
        }, ...users])
      }

      closeModal()
    } catch (err: any) {
      console.error('Error saving user:', err)
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 비밀번호 재설정
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordResetUser) return

    setIsLoading(true)
    setError(null)

    try {
      if (newPassword.length < 6) {
        throw new Error('비밀번호는 6자 이상이어야 합니다.')
      }

      const result = await resetPasswordAction(passwordResetUser.id, newPassword)

      if (!result.success) {
        throw new Error(result.error)
      }

      alert('비밀번호가 재설정되었습니다.')
      closePasswordModal()
    } catch (err: any) {
      console.error('Error resetting password:', err)
      setError(err.message || '비밀번호 재설정 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 삭제 - Server Action 사용 (Auth와 DB 모두 삭제)
  const handleDelete = async (userId: string) => {
    if (!confirm('정말 삭제하시겠습니까? Auth 계정도 함께 삭제됩니다.')) return

    setIsLoading(true)
    try {
      const result = await deleteUserAction(userId)

      if (!result.success) {
        throw new Error(result.error)
      }

      setUsers(users.filter((u) => u.id !== userId))
    } catch (err: any) {
      console.error('Error deleting user:', err)
      alert(err.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 역할 라벨
  const getRoleLabel = (role: string) => {
    return role === 'admin' ? '관리자' : '매니저'
  }

  // 역할 배지 색상
  const getRoleBadgeClass = (role: string) => {
    return role === 'admin'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800'
  }

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-primary-600">
              대시보드
            </Link>
            <span>/</span>
            <span>사용자 관리</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
          <p className="mt-1 text-gray-600">
            총 {users.length}명의 사용자가 등록되어 있습니다.
          </p>
        </div>
        <button
          onClick={openAddModal}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          새 사용자 추가
        </button>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="이름 또는 아이디로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* 역할 필터 */}
          <div className="flex gap-2">
            {(['all', 'admin', 'manager'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterRole === role
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {role === 'all' ? '전체' : getRoleLabel(role)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 사용자 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  아이디
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  역할
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{user.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(
                          user.role
                        )}`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          disabled={isLoading}
                          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          title="수정"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => openPasswordModal(user)}
                          disabled={isLoading}
                          className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                          title="비밀번호 재설정"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={isLoading}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm || filterRole !== 'all'
                      ? '검색 결과가 없습니다.'
                      : '등록된 사용자가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? '사용자 수정' : '새 사용자 추가'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* 새 사용자 추가 시에만 이메일/비밀번호 표시 */}
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="user@example.com"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">로그인에 사용됩니다</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      비밀번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="6자 이상"
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  아이디
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="사용자 아이디"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="사용자 이름"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  역할
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'manager',
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : editingUser ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 모달 */}
      {showPasswordModal && passwordResetUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                비밀번호 재설정
              </h2>
              <button
                onClick={closePasswordModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>{passwordResetUser.name}</strong> ({passwordResetUser.username})님의 비밀번호를 재설정합니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="6자 이상"
                  minLength={6}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '재설정 중...' : '비밀번호 재설정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
